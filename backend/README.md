# LUERS Backend

Django REST Framework backend for **LUERS** (Lira University Emergency Reporting System) — lets students and staff report campus incidents, routes them to the right department, and lets department heads and their responders track them through to resolution.

## Tech stack

- Django 6 + Django REST Framework, JWT auth (`djangorestframework-simplejwt`)
- PostgreSQL (via `psycopg2`)
- Channels + Redis (WebSocket live updates for the triage queue and in-report chat)
- Celery + Redis (async SMS/email dispatch, off the request path)
- `drf-spectacular` for an auto-generated, always-current API reference (see below)

## Setup

1. **Start Postgres and Redis:**
   ```bash
   docker compose up -d
   ```
2. **Create a virtualenv and install dependencies:**
   ```bash
   python -m venv .venv
   .venv/Scripts/activate   # or source .venv/bin/activate on macOS/Linux
   pip install -r requirements.txt
   ```
3. **Configure environment:** copy `.env.example` to `.env` and fill in `SECRET_KEY` at minimum. Everything else has a sane local default (Postgres/Redis on `localhost`, Mailtrap sandbox for outbound email, Twilio fields optional — SMS dispatch just logs if unset).
4. **Migrate and seed:**
   ```bash
   python manage.py migrate
   python manage.py seed_data
   ```
   `seed_data` creates exactly the 3 accounts that always exist by design (`student_user`, `staff_user`, `system_admin_user`, password `password123`) plus a full, headless department set — no responders or department heads. Those only come into existence through the app itself: `system_admin` creates a head, a head creates their department's responders, and students/staff can also self-register. See [Roles & permissions](#roles--permissions).
5. **Run the dev server:**
   ```bash
   python manage.py runserver 8000
   ```
6. **Run a Celery worker** (separate terminal) — required for password-reset, account-invite, and any other email/SMS to actually be delivered:
   ```bash
   celery -A luers_backend worker --loglevel=info --pool=solo  # --pool=solo is required on Windows
   ```
   Email/SMS dispatch is `.delay()`'d onto Celery (`apps/notifications/tasks.py`), not sent inline in the request. Without a worker running, tasks just sit in Redis forever — Mailtrap/Twilio never receive anything, and nothing in the API response indicates a problem (the enqueue itself always succeeds). If outbound mail seems to silently vanish, check for a running worker before suspecting the SMTP credentials.

## Running tests

```bash
python manage.py check   # system checks — fast sanity check after any settings/model change
pytest --cov
```

Tests run with `pytest.ini`'s `--nomigrations`, which skips the migration graph entirely (including `RunPython` data migrations) for speed — role/permission seed data is instead provided by a `conftest.py` fixture sharing `apps/accounts/role_seed_data.py` with the real migration. This means a broken *migration* won't be caught by `pytest` — if you change a migration, verify it separately with a real `migrate` against a fresh database.

## Roles & permissions

Authorization is **Role → Permission**, both database-backed (`apps.accounts.models.Role`/`Permission`), not a fixed enum — capabilities are added by attaching a `Permission` row to a `Role`, never by touching code. Five roles are the live target model:

| Role | Typical permissions | Notes |
|---|---|---|
| `student` / `staff` | `create_report` | File incident reports |
| `responder` | `view_admin_dashboard` | Works assigned reports; capability comes from *relationships* below, not the role itself |
| `department_head` | `view_admin_dashboard` | Same permission footprint as `responder` — a head's actual authority (which department, which reports) comes entirely from `Department.head`/`members`, never from the role |
| `system_admin` | everything, incl. `manage_roles`/`view_all_reports` | Full platform access |

**Department headship is still a relationship, layered on top of a dedicated role.** Every authorization check that cares about headship (`is_department_head_or_system_admin`, `is_department_member_or_head`, `get_accessible_reports`, `get_accessible_audit_logs` — all in `apps/reports/services.py`) keys off `Department.head_id`/`members`, not the account's role — a head's scoping to "their own department only" would be unaffected even if the role didn't exist. `department_head` exists so a head's account is visibly distinct from a plain responder's (in the admin UI, in audit logs, in `who is a responder` accounting), not to carry any extra permission.

**`responder` and `department_head` are the only two roles you can't hand out through the general create/update serializers directly.** `AdminUserCreateSerializer`/`AdminUserUpdateSerializer` (`system_admin`'s "Manage users" UI) reject assigning anyone into either via their own `role` field, whether creating a new account or reassigning an existing one. There are exactly two ways these accounts come into existence:

- `POST /api/v1/departments/{id}/heads/` (`DepartmentHeadCreateView`) — `system_admin`/`manage_departments` only, creates a `department_head` account and assigns it as the department's head in one step (reassigns if one already exists). The frontend's "New user" page also reaches this same endpoint: picking `Department Head` in the role picker swaps in a department selector and routes the submission here instead of the general create endpoint, so a head is always created department-scoped and provisioned identically (temp password + invite email) regardless of which screen the admin started from.
- `POST /api/v1/departments/{id}/responders/` (`DepartmentResponderCreateView`) — a department's own head only, adds a `responder` account as a plain member of that department.

Both go through the same `AccountProvisioningService.create_account` (`apps/accounts/services.py`): a real, usable temp password is generated and emailed to the new account (login link + username + password), and `User.must_change_password` is set — the frontend (`RequireAuth`) redirects any such account straight to a forced password-change page until they clear it via `POST /api/v1/auth/change-password/`, which is what actually flips the flag off. This is deliberately different from `PasswordResetService` (unusable password + reset-link email), which is only for the existing self-service "forgot password" flow.

An account that's already a responder or department_head can still be edited (email, active state) without being forced off the role.

The three legacy roles (`security`, `ict_admin`, `management`) that used to exist alongside these four were deleted outright (migration `accounts/0013_delete_legacy_roles`), not just deactivated — there's no historical-only role data left to account for. The dev environment's user set was reset to just the 3 core accounts (migration `accounts/0014_reset_users_to_core_three`) — every department starts headless, matching a fresh install. `department_head` was added as a dedicated role (migration `accounts/0016_add_department_head_role`) after that reset — existing heads created before this migration keep whatever role they already held.

### Report visibility — one function, four rules

Every place a report or its audit trail is ever shown — the REST list/detail views, the WebSocket consumer, exports, dashboard analytics — routes through a single function, `apps.reports.services.get_accessible_reports(user)` (and its audit-log counterpart, `get_accessible_audit_logs`). Exactly four rules, combined with OR:

1. **Reporter** — any report they personally filed.
2. **Responder** — any report assigned to them.
3. **Department Head** — every report in the department(s) they head.
4. **System Admin** — everything, unconditionally.

If you're adding a new place that needs to know "can this user see this report," call `apps.reports.services.can_access_report(user, report)` — never re-derive the rule locally.

### Who can change what on a report

Visibility (above) and mutation rights are deliberately different populations:

- **Assign** (`POST /reports/{id}/assign/`, `is_department_head_or_system_admin`) — the report's department head, or System Admin.
- **Update status** (`PATCH /reports/{id}/status/`) — only the report's `assigned_to` responder, full stop. Not the head, not System Admin, not the reporter. Heads assign and monitor; the assigned responder is the one actually in the field, so they're the only one who marks progress. Enforced identically on the REST endpoint, the bulk-status endpoint (`BulkStatusUpdateView`), and the WebSocket `status_update` message handler — all three call the same `report.assigned_to_id == user.id` check rather than three independent implementations.
- Each candidate returned by `GET /reports/{id}/assignable-officers/` also carries `open_report_count` — how many currently-open reports they already have, informational only (no server-side block on assigning an already-busy responder).

### Report submission: phone number, and voice/video as evidence

`POST /reports/create/` accepts an optional `phone_number` field, persisted onto `reporter.phone_number` when provided (`ReportService.create_report`, `apps/reports/services.py`) — the frontend makes this conditionally *required* (only when the reporter's profile has none on file yet), but the backend itself stays permissive, consistent with how this codebase treats client-side UX requirements versus server-side security boundaries.

There's no dedicated "voice description"/"video description" field on `Report` — recording a voice note or video instead of typing a description (`MediaRecorderControl.tsx` on the frontend, wrapping `MediaRecorder`/`getUserMedia`) attaches the recording as ordinary `Evidence`, same as any other file upload, with `description` auto-filled with a short placeholder. Chrome/Firefox's `MediaRecorder` outputs WebM containers for both audio-only and video capture with identical magic bytes — `apps/core/file_validation.py` disambiguates them by claimed extension instead of content alone: `.weba` (audio) and `.webm` (video) both sniff to the same EBML signature but resolve to their respective `Evidence.file_type` category once that signature is confirmed.

### Self-registration

`POST /api/v1/auth/register/` (`SelfRegisterView`, `AllowAny`, rate-limited `5/h` per IP like the password-reset endpoints) lets students and staff create their own account — the only two roles a registrant can pick, enforced by `SelfRegisterSerializer.role`'s queryset (`slug__in=['student', 'staff']`) rather than the actor-aware `_validate_role_assignment` guard used elsewhere (there's no authenticated actor here to check). Accounts are active immediately, with no admin-approval step — consistent with every other account in this system having no identity-verification step. The created account is never auto-logged-in; the client separately calls `POST /api/v1/auth/login/`.

### Report exports

`GET /api/v1/reports/export/` and `GET /api/v1/audit/export/` (`?export_format=csv|pdf`) share `apps.core.export.pdf_response`, which wraps every cell in a `Paragraph` (so long text wraps instead of overflowing the page) and takes explicit per-column `colWidths` proportioned to the ~9.6in usable width of a landscape-letter page. The PDF branch of each view also truncates IDs to 8 characters and formats timestamps without seconds/timezone — and, for the audit export, caps `before_state`/`after_state` (raw JSON snapshots, otherwise unbounded) to 150 characters with an ellipsis — purely for the PDF's fixed page width; the CSV export of the same data stays untruncated.

### Report location

`Report.latitude`/`longitude` (submitted via the frontend's `navigator.geolocation`, `src/lib/geolocation.ts` in the frontend repo) are already serialized on every report list/detail response with no extra permission gating — visibility is governed purely by whether the requester can see the report at all. They're `DecimalField`s, so DRF renders them as strings, not JSON numbers — any consumer needs to coerce before doing arithmetic on them. The frontend renders them on a Leaflet/OpenStreetMap map (`ReportLocationMap.tsx`) on the report detail page; a report submitted without geolocation permission just shows a "Location not available" placeholder instead.

### Voice notes in report chat

`Message` (`apps/notifications/models.py`) has an optional `attachment` FileField alongside `content` — `content` is only required when there's no attachment. Voice notes go through the existing REST `MessageCreateView`/`MessageCreateSerializer` (`apps/notifications/views.py`), not the WebSocket text-chat path (binary upload over Channels' JSON protocol is awkward) — after creating the message, the view broadcasts it to the report's `report_{id}` WebSocket group itself, using the same `channel_layer.group_send` shape `ReportConsumer`'s own `chat_message` handler uses for text, so a live listener sees a voice note immediately rather than waiting for a `GET /reports/{id}/messages/` refetch.

### Privilege-escalation guards

- No user may ever edit their own `role` field, through any endpoint, regardless of permission held.
- Assigning `system_admin` (or any role carrying `manage_roles`) requires the *actor* to already hold `manage_roles` — `manage_users` alone isn't enough.
- No user may deactivate their own account (would otherwise let a lone `system_admin` lock themselves out instantly — `is_active` is rechecked on every authenticated request).
- Account-admin actions (role changes, activate/deactivate, admin-created accounts, department-scoped responder creation) are all written to `AuditLog`.

## API reference

Full, always-current endpoint documentation is auto-generated — run the server and visit `/api/docs/` (Swagger UI) or `/api/schema/` (raw OpenAPI). Top-level namespaces: `/api/v1/auth/`, `/api/v1/reports/`, `/api/v1/departments/`, `/api/v1/dashboard/`, `/api/v1/audit/`, `/api/v1/roles/`, `/api/v1/permissions/`.

## Other docs

- [`docs/postgres-backup-runbook.md`](docs/postgres-backup-runbook.md) — local Postgres backup/restore drill.
