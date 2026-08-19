# LUERS Frontend

React + TypeScript client for **LUERS** (Lira University Emergency Reporting System) — lets students and staff report campus incidents, and gives department heads and responders a queue to track and resolve them.

## Tech stack

- React 19 + TypeScript, Vite
- Tailwind CSS v4 (via `@tailwindcss/vite`) — colors and spacing come from CSS custom properties in `src/index.css`'s `@theme` block, including full dark-mode support (`ThemeToggle`) with zero per-component `dark:` classes
- `@tanstack/react-query` for server state, `react-hook-form` + `zod` for forms
- `react-router-dom` v7 data router, with route-level `RequireAuth` permission gating
- `react-i18next` (English only today; infrastructure is in place — see `lib/labels.ts`)
- `vite-plugin-pwa` (offline report-creation queue, installable PWA)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and point it at a running backend (defaults already match the backend's own default dev port — the backend lives on the `fix/backend-blockers-pre-frontend` branch of this same repo, see its own `README.md` there):
   ```
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   VITE_WS_BASE_URL=ws://localhost:8000
   ```
3. Run the dev server:
   ```bash
   npm run dev
   ```
   Vite hardcodes its dev port to **5175** in `vite.config.ts` — `--port` overrides are ignored, so if you need a second instance running side-by-side, change the port in that file rather than the CLI flag.

## Running checks

```bash
npm run build       # tsc -b && vite build — the authoritative typecheck; see note below
npx tsc -b --noEmit  # faster, but has been seen to pass over an error `npm run build` catches
npm run lint         # oxlint
npm test             # vitest run
```

`tsc -b --noEmit` is not a fully reliable substitute for `npm run build` in this codebase — an incremental-build-cache issue has let at least one real type error through `--noEmit` that the real build caught. Treat `npm run build` as the source of truth before calling a change verified.

## Authorization model

`user.permissions` is a flat slug array from `/api/v1/auth/me/` — there is no compile-time `Role` union. `RequireAuth`'s `requirePermission` prop gates each route on one specific permission (see `App.tsx`); component-level UI (buttons, sections) checks the same array directly (`user?.permissions.includes('...')`). Adding a backend permission needs zero frontend code changes to show up wherever the backend's own `/permissions/` catalogue is rendered (e.g. the role-editor checklist).

### Dashboard layout

`DashboardPage.tsx` renders a different layout depending on which of three tiers the signed-in user falls into (detected via `user.permissions` plus whether they head any department — see `HEAD_DETECTION_DEPARTMENTS_QUERY_KEY` in `lib/departments-api.ts`):

- **System Admin** — full campus summary, trends, and analytics. Oversight-only: view-only on report detail, no assign/status controls, and can't provision responders through general user management (see backend README) — head/responder accounts are provisioned through the department UI instead.
- **Department Head** — department-scoped summary/trends/analytics, plus a responder roster and inline "add responder" form (`MyDepartmentResponders.tsx`) for the department(s) they head. The roster shows each responder's busy/free state (open-report count from `/dashboard/analytics/`'s `responder_workload`, matched by username). Heads assign reports but do not update status — that's the assigned responder's job alone.
- **Plain responder** — a focused view: their own report summary plus a compact list of their open assigned reports (`MyAssignedReportsPanel.tsx`, filtered server-side via `assigned_to`) linking straight to the queue, rather than manager-oriented trend/analytics panels that would otherwise just chart one person's handful of reports. Can update status on their own assigned reports.

### Provisioning department heads/responders

`system_admin` can create a department's head from two places: inline on `DepartmentFormPage.tsx` ("Create a new head", `AddHeadForm`, `POST /departments/{id}/heads/`), or from the general "New user" page (`AdminUserFormPage.tsx`) — picking `Department Head` in the role picker (only shown when the acting admin holds `manage_departments`) swaps the password field for a required department picker and routes the submission through the same `createDepartmentHead` API call, so a head is always created department-scoped regardless of entry point. A head creates their own department's responders from the dashboard (`MyDepartmentResponders.tsx`'s `AddResponderForm`, unchanged). All these flows create the account with a real temp password emailed to them — no password ever transits the browser. The account is force-redirected (`RequireAuth`, gated on `user.must_change_password`) to `ChangePasswordRequiredPage` on first login, which reuses the same `ChangePasswordForm` component as the profile page's self-service change; completing it clears the flag and releases the redirect.

Students and staff can alternatively self-register at `/register` (`RegisterPage.tsx`, `POST /auth/register/`) — a 2-option Student/Staff control rather than the full admin `RoleSelect`, so the form can't expose a privileged role even if `RoleSelect`'s filtering logic changes later. Registration activates the account immediately and does not auto-log-in; the registrant is redirected to `/login` with a success notice.

Both `AddHeadForm` and `AddResponderForm` render their own `<form>` — keep them (and any similar future create-inline-account form) rendered as siblings of the enclosing page's own `<form>`, never nested inside it. A `<form>` inside a `<form>` is invalid HTML; the browser silently de-nests it, which breaks `.requestSubmit()`/submit-button semantics for one of the two forms without raising any error you'd notice outside the console (`DepartmentFormPage.tsx`'s head-creation form is deliberately positioned after the page's main `</form>` for this reason). Heads created since the `department_head` role was added (see backend README) hold that role rather than `responder` — `DepartmentFormPage.tsx`'s head-reassignment dropdown and `RoleSelect.tsx`'s `excludeResponder`/`excludeDepartmentHead` props both account for either.

### Voice/video recording

`MediaRecorderControl.tsx` wraps `navigator.mediaDevices.getUserMedia` + `MediaRecorder` and is shared by two features:

- **Report description** (`ReportCreatePage.tsx`) — a Text/Voice/Video toggle above the description field; recording in voice or video mode attaches the result as `Evidence` (same upload path as the existing file picker) and auto-fills `description` with a short placeholder, since the backend still requires that field for a normal report. Video mode shows a live self-preview (the `MediaStream` is attached to a `<video autoPlay muted>` element via `srcObject`, not just a recording timer). Photo capture is a separate, independent component (`PhotoCaptureControl.tsx`) rendered below the description section regardless of mode — not nested under video recording — used on both this form and the `/emergency` flow (see below).
- **Chat voice notes** (`ReportChat.tsx`) — a "Voice note" button next to the text input records audio and sends it via `sendVoiceMessage` (`lib/notifications-api.ts`), a REST multipart call (not the WebSocket text-chat path) — the server broadcasts the resulting message itself, so it appears live without a refetch.

Chrome/Firefox's `MediaRecorder` only outputs WebM containers for both audio and video capture, with identical magic bytes for either — the recorder tags audio-only recordings with a `.weba` extension and video with `.webm` so the backend can tell them apart by claimed extension (see backend README's file-validation note); `evidence-constraints.ts`'s `ALLOWED_EVIDENCE_EXTENSIONS` includes both.

### Report location map

`ReportDetailPage.tsx` renders `ReportLocationMap.tsx` — a `leaflet`/`react-leaflet` map (free OpenStreetMap tiles, no API key) showing a pin at `report.latitude`/`longitude`, or a "Location not available" message when either is null. The backend serializes these as strings (DRF's default for `DecimalField`), not JSON numbers, despite the domain type claiming `number` — the component coerces with `Number(...)` and checks `Number.isFinite` before trusting them, rather than calling `.toFixed()` straight on the prop. `ActiveEmergenciesMap.tsx` (on `TriageQueuePage.tsx`) is the "many reports on one map" sibling — same library, same custom-SVG-pin workaround for Leaflet's Vite-broken default marker assets, but a red pulsing pin and one marker per currently-open panic report (`?urgency=panic&active=true`).

### Emergency/panic flow

Panic is a distinct flow, not a mode toggle on the ordinary report form:

- **`/emergency`** (`EmergencyPage.tsx`) — 5 large emergency-type tap targets (security/medical/fire/accident/other), no department picker (the backend routes deterministically from the type — see backend README). Geolocation starts resolving on mount, in parallel; `SEND EMERGENCY` never awaits it. If coordinates resolve after the report already exists, a follow-up `PATCH /reports/{id}/location/` (`updateReportLocation`) sends them. Description and a photo (`PhotoCaptureControl.tsx`) are optional, tucked under a collapsed "Add details" section.
- **Always-reachable entry point**: a persistent "Emergency" button in `AppLayout.tsx`'s header, visible on every authenticated page except `/emergency` itself — the old in-form "This is an emergency" toggle on `ReportCreatePage.tsx` now just navigates to `/emergency` instead of switching local state; that form is exclusively the non-urgent path.
- **`ReportDetailPage.tsx`** renders two panic-only sections when `report.urgency === 'panic'`: `EmergencyStatusChecklist.tsx` (a live received → notified → acknowledged → responding → arrived → resolved checklist, driven by `report.emergency_dispatch`, refetched over the existing `report_{id}` WebSocket group — no new realtime plumbing) and `EmergencyActionsControl.tsx` (acknowledge/respond/arrive/cancel/false-alarm/escalate buttons, shown based on best-effort client-side role/assignment checks — the backend is the real authorization gate, e.g. a reporter clicking "Acknowledge" gets a clean inline 403 message, not a silent failure).
- **Offline queue priority** (`lib/offline-queue.ts`): `getQueuedReports()`'s sort comparator puts panic-queued reports ahead of routine ones, FIFO within each tier — a panic report queued after a routine one no longer waits behind it once connectivity returns. `PendingReportsIndicator.tsx` shows a distinct red/pulsing treatment when the head of the queue is a panic report.

## Verifying live

There's no dedicated route-level (`routes/*.test.tsx`) or API-mock (`*-api.test.ts`) test tier in this codebase by convention — components with meaningful logic get a focused unit test (see `components/**/*.test.tsx`), and full user flows are instead verified by hand against a real running backend.
