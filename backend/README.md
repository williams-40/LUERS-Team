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
   `seed_data` creates one user per live role slug (`student_user`, `staff_user`, `responder_user`, `system_admin_user`), all with password `password123`, plus a full department set. See [Roles & permissions](#roles--permissions).
5. **Run the dev server:**
   ```bash
   python manage.py runserver 8000
   ```

## Running tests

```bash
python manage.py check   # system checks — fast sanity check after any settings/model change
pytest --cov
```

Tests run with `pytest.ini`'s `--nomigrations`, which skips the migration graph entirely (including `RunPython` data migrations) for speed — role/permission seed data is instead provided by a `conftest.py` fixture sharing `apps/accounts/role_seed_data.py` with the real migration. This means a broken *migration* won't be caught by `pytest` — if you change a migration, verify it separately with a real `migrate` against a fresh database.

## Roles & permissions

Authorization is **Role → Permission**, both database-backed (`apps.accounts.models.Role`/`Permission`), not a fixed enum — capabilities are added by attaching a `Permission` row to a `Role`, never by touching code. Four roles are the live target model:

| Role | Typical permissions | Notes |
|---|---|---|
| `student` / `staff` | `create_report` | File incident reports |
| `responder` | `view_admin_dashboard` | Works reports; capability comes from *relationships* below, not the role itself |
| `system_admin` | everything, incl. `manage_roles`/`view_all_reports` | Full platform access |

**Department headship is a relationship, not a role.** Any active user can head or belong to a `Department` (`Department.head`, `Department.members`); this is what actually differentiates one responder from another — a department head can create new responder accounts scoped to their own department (`POST /api/v1/departments/{id}/responders/`) and sees their department's full report/audit history, while a plain responder sees only what's assigned to them.

**Responder is the only role you can't hand out through general user management.** `AdminUserCreateSerializer`/`AdminUserUpdateSerializer` (`system_admin`'s "Manage users" UI) reject assigning anyone into `responder`, whether creating a new account or reassigning an existing one — the department-head endpoint above is the sole path. An account that's already a responder can still be edited (email, active state) without being forced off the role.

The three legacy roles (`security`, `ict_admin`, `management`) that used to exist alongside these four were deleted outright (migration `accounts/0013_delete_legacy_roles`), not just deactivated — there's no historical-only role data left to account for.

### Report visibility — one function, four rules

Every place a report or its audit trail is ever shown — the REST list/detail views, the WebSocket consumer, exports, dashboard analytics — routes through a single function, `apps.reports.services.get_accessible_reports(user)` (and its audit-log counterpart, `get_accessible_audit_logs`). Exactly four rules, combined with OR:

1. **Reporter** — any report they personally filed.
2. **Responder** — any report assigned to them.
3. **Department Head** — every report in the department(s) they head.
4. **System Admin** — everything, unconditionally.

If you're adding a new place that needs to know "can this user see this report," call `apps.reports.services.can_access_report(user, report)` — never re-derive the rule locally.

### Privilege-escalation guards

- No user may ever edit their own `role` field, through any endpoint, regardless of permission held.
- Assigning `system_admin` (or any role carrying `manage_roles`) requires the *actor* to already hold `manage_roles` — `manage_users` alone isn't enough.
- No user may deactivate their own account (would otherwise let a lone `system_admin` lock themselves out instantly — `is_active` is rechecked on every authenticated request).
- Account-admin actions (role changes, activate/deactivate, admin-created accounts, department-scoped responder creation) are all written to `AuditLog`.

## API reference

Full, always-current endpoint documentation is auto-generated — run the server and visit `/api/docs/` (Swagger UI) or `/api/schema/` (raw OpenAPI). Top-level namespaces: `/api/v1/auth/`, `/api/v1/reports/`, `/api/v1/departments/`, `/api/v1/dashboard/`, `/api/v1/audit/`, `/api/v1/roles/`, `/api/v1/permissions/`.

## Other docs

- [`docs/postgres-backup-runbook.md`](docs/postgres-backup-runbook.md) — local Postgres backup/restore drill.
