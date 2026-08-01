# Identity-escrow key rotation & retention

Background: `ReportIdentity.encrypted_reporter_ref` (`apps/reports/models.py`)
stores the real reporter behind an anonymous report, Fernet-encrypted under
`FERNET_KEYS`. `ReportIdentity.reporter_hash` is a separate one-way HMAC
(keyed by `IDENTITY_HASH_KEY`) used only to answer "is this my report" —
it's never decrypted or decryptable. These two keys have very different
rotation stories.

## FERNET_KEYS — rotatable

`FERNET_KEYS` (settings/base.py) is a comma-separated list, newest key
first. `EncryptionService` (`apps/core/services.py`) builds a `MultiFernet`
from it: **encrypt always uses the first key; decrypt tries every key in
the list**. That's what makes rotation possible without a "flag day" where
old data becomes unreadable.

### When to rotate

- Suspected key compromise (leaked `.env`, compromised deployment secret
  store, offboarded engineer who had access) — rotate immediately.
- Routine hygiene — annually is a reasonable default for a system handling
  identity-escrow data, absent a stricter institutional policy.

### How to rotate

1. Generate a new key and re-encrypt existing data in one step:
   ```bash
   python manage.py rotate_fernet_key
   ```
   This decrypts every `ReportIdentity.encrypted_reporter_ref` using
   whatever's currently in `FERNET_KEYS`, re-encrypts it under a freshly
   generated key, and prints that key **once** — save it immediately. (Pass
   `--new-key <key>` instead if you're supplying your own, e.g. from a
   secrets manager that generated it.)
2. Read the command's summary: it reports how many rows were migrated and
   flags (without crashing) any that couldn't be decrypted under any
   currently-configured key — that's a data-integrity problem to
   investigate before continuing, not something to ignore.
3. Prepend the new key to `FERNET_KEYS` in the deployment's actual secrets
   (not just `.env.example`) and restart the app. Order matters — the
   first entry is what new encryptions use.
4. Keep the old key in `FERNET_KEYS` for a while after rotating (a few days
   to a couple of weeks, judgment call) in case anything was missed by step
   1 — the `MultiFernet` fallback means old-key ciphertext still works as
   long as the old key is still listed.
5. Once confident (zero failures in step 2, app healthy since restart),
   drop the retired key from `FERNET_KEYS` in a follow-up deploy. This is a
   manual step — nothing automatically prunes old keys.

### Rollback

If a rotation goes wrong, the fix is almost always "put the old key back
first in `FERNET_KEYS`" — as long as it wasn't already dropped, no data was
lost, since `rotate_fernet_key` re-encrypts rather than deletes.

## IDENTITY_HASH_KEY — deliberately NOT rotated the same way

`reporter_hash` is an HMAC, not encryption — there is no `MultiFernet`
equivalent for a one-way hash: you cannot "try the old key too" when
comparing hashes, so rotating `IDENTITY_HASH_KEY` the same way would
silently invalidate every existing `reporter_hash` (breaking every
existing reporter's "my reports" visibility, see
`get_accessible_reports` in `apps/reports/services.py`) with **no error
and no way to detect it after the fact** — it would just look like those
reports quietly vanished for their owners.

If `IDENTITY_HASH_KEY` is ever suspected compromised, the correct response
is a **one-time re-derivation**, not an ongoing rotation:

1. Decrypt every `ReportIdentity.encrypted_reporter_ref` (the
   `rotate_fernet_key` command already does exactly this) to recover the
   underlying user id.
2. Recompute `reporter_hash = EncryptionService.hash_for_lookup(user_id)`
   for every row under the new `IDENTITY_HASH_KEY`, in the same migration
   pass, so there's no window where hashes are stale.
3. Deploy the new `IDENTITY_HASH_KEY` and the recomputed hashes together —
   not the key first, unlike `FERNET_KEYS` rotation.

This isn't built as a management command yet since it's only needed in
response to a suspected compromise, not routine hygiene — write it when
(if) that happens, reusing `rotate_fernet_key`'s decrypt loop as the
starting point.

## Retention tie-in

A `ReportIdentity` row's reason for existing ends when its `Report` does.
`ReportIdentity` and `Evidence` both `CASCADE`-delete off `Report`
(`apps/reports/models.py`), so the report soft-delete/purge cycle already
handles escrow-data retention for free:

- `POST /api/v1/reports/{id}/delete/` soft-deletes (sets `deleted_at`) —
  the identity row is untouched, still escrow-protected, just excluded
  from every normal view.
- `python manage.py purge_deleted_reports --days 90` hard-deletes reports
  soft-deleted longer than the retention window, which cascades to
  `ReportIdentity` and `Evidence` automatically.

No separate retention job is needed for identity data specifically — it
rides on the report retention policy above. See
[`postgres-backup-runbook.md`](postgres-backup-runbook.md) for how this
interacts with backups (a purged identity row can still exist in an old
backup — that's expected and is itself bounded by the backup retention
window documented there).
