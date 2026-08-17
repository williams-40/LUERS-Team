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

- **System Admin** — full campus summary, trends, and analytics.
- **Department Head** — department-scoped summary/trends/analytics, plus a responder roster and inline "add responder" form (`MyDepartmentResponders.tsx`) for the department(s) they head.
- **Plain responder** — a focused view: their own report summary plus a compact list of their open assigned reports (`MyAssignedReportsPanel.tsx`) linking straight to the queue, rather than manager-oriented trend/analytics panels that would otherwise just chart one person's handful of reports.

## Verifying live

There's no dedicated route-level (`routes/*.test.tsx`) or API-mock (`*-api.test.ts`) test tier in this codebase by convention — components with meaningful logic get a focused unit test (see `components/**/*.test.tsx`), and full user flows are instead verified by hand against a real running backend.
