# Postgres backup runbook

Scope: the local Docker Compose Postgres (`backend/docker-compose.yml`,
container `luers_postgres`, database `luers_db`). LUERS has no production
deployment yet — when one exists, adapt the commands below to that
provider's connection details rather than starting over; the underlying
`pg_dump`/`pg_restore` procedure doesn't change.

## Sensitivity note

The database is plaintext throughout (`Report.description`, `Report.reporter`,
location data, usernames, audit logs). **A backup file needs the same
access-control rigor as the live database, not less.** Don't email dumps,
don't leave them in a world-readable folder, don't commit them (the
`backend/backups/` directory used below is gitignored).

## Backup

From `backend/`, with the Docker Compose stack running:

```powershell
.\scripts\backup_db.ps1
```

This runs `pg_dump -Fc` (custom format — required for selective/parallel
`pg_restore` later, unlike plain-text SQL dumps) inside the `luers_postgres`
container and writes a timestamped file to `backend/backups/`, e.g.
`backend/backups/luers_db_2026-08-01_143000.dump`.

Manual equivalent, if you need to run it by hand:

```powershell
docker exec luers_postgres pg_dump -U luers_user -Fc luers_db > backend\backups\luers_db_manual.dump
```

## Restore

```powershell
.\scripts\restore_db.ps1 -DumpFile "backups\luers_db_2026-08-01_143000.dump"
```

This copies the dump into the container and runs `pg_restore --clean
--if-exists` against `luers_db` (`--clean --if-exists` drops existing
objects first so the restore is idempotent against a non-empty database,
rather than erroring on "already exists").

Manual equivalent:

```powershell
docker cp backend\backups\luers_db_2026-08-01_143000.dump luers_postgres:/tmp/restore.dump
docker exec luers_postgres pg_restore -U luers_user -d luers_db --clean --if-exists /tmp/restore.dump
```

## Restore drill (do this, don't just trust the backup exists)

A backup that's never been restored is unverified. Periodically (and
whenever this runbook or the schema changes materially):

1. Bring up a scratch Postgres container so the drill can't touch real
   dev/prod data:
   ```powershell
   docker run --rm -d --name luers_pg_restore_drill -e POSTGRES_DB=luers_db `
     -e POSTGRES_USER=luers_user -e POSTGRES_PASSWORD=luers_password `
     -p 5434:5432 postgres:15-alpine
   ```
2. Restore the dump into it: `docker cp` + `pg_restore` as above, but
   targeting `luers_pg_restore_drill`.
3. Point a throwaway `DATABASE_URL`/`.env` at `localhost:5434` and run
   `python manage.py check --database default` plus a spot query (e.g.
   confirm a known report's `description` and row counts match the
   source) to prove the restore is actually usable, not just "pg_restore
   exited 0."
4. Tear down: `docker stop luers_pg_restore_drill` (the container is
   `--rm`, so stopping it also removes it).

## Recommended cadence & retention

No scheduler exists in this codebase yet (no Celery beat, no cron job) —
this is a recommendation to action manually or via an external scheduler,
not something `backup_db.ps1` sets up on its own:

- Daily dump, retain 30 days.
- One dump per month promoted to a longer-lived monthly retention, kept 6
  months.
- Delete backups past retention the same way any other stale file would be
  cleaned up — there's no automated purge for `backend/backups/` here,
  matching how `purge_deleted_reports` is also a manually/cron-run command
  rather than a beat schedule.
