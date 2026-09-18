# Production Runbook — Konfequem

## Architecture
- **Frontend:** Netlify → `https://konfequem.netlify.app` (auto-deploys from `main`)
- **Backend:** Render → `https://konfequem-backend.onrender.com` (auto-deploys from `main`)
- **Database:** Supabase Postgres (transaction pooler `:6543` for the app,
  session pooler `:5432` for `pg_dump`)
- **CI:** GitHub Actions — tests (SQLite + PostgreSQL passes), flake8/black,
  daily encrypted backup, uptime pings every 30 min

## Deploy
1. Push to `main` → Render + Netlify deploy automatically.
2. Watch CI (`gh run watch`); CI does not gate the deploy — it only alerts.
3. **Gotcha:** an *empty* commit does not trigger a Render auto-deploy — use
   the Render dashboard "Manual Deploy" in that case.
4. Migrations run on boot (entrypoint). A failing migration = broken deploy:
   check `makemigrations --check` locally / CI before pushing schema work.

## Rollback
- **Backend:** Render dashboard → Deploys → "Rollback to this deploy"
  (rolls back code, *not* the database — mind migrations; a rolled-back
  code with newer migrations can still run if migrations are backward
  compatible, verify before rolling back across a migration).
- **Frontend:** Netlify → Deploys → publish a previous deploy.
- **Code:** `git revert <sha>` + push (preferred — keeps history linear).

## Restore backup (the drill — run monthly)
Dumps are age-encrypted; the private key (`backup_age.key`) is NOT in
GitHub. Full recipe: header of `.github/workflows/backup.yml`.
1. `gh run download <run-id> -n supabase-backup -D /tmp/bak`
2. `age -d -i backup_age.key -o /tmp/bak/dump.dump /tmp/bak/dump.dump.age`
3. Verify: `file /tmp/bak/dump.dump` → PostgreSQL custom dump
4. Restore into a **scratch** database first, never in-place:
   `createdb ... konfequem_restore && pg_restore ... --dbname=konfequem_restore`
5. Only then promote (repoint DATABASE_URL / dump-and-swap).

## Secret rotation
| Secret | Where | How |
|---|---|---|
| Superuser password | Django admin | Admin UI "Change password" **first** — `SUPERUSER_PASSWORD` env is only read on first-boot user creation and never updates an existing user. Sync the Render env var afterwards. |
| `DATABASE_URL` | Render env + GH secret `SUPABASE_DB_URL` | Rotate in Supabase → update Render → update the backup secret. |
| `JWT_SIGNING_KEY` | Render env | Rotating invalidates **all** tokens (everyone re-logs in). Use only on compromise. |
| `BACKUP_AGE_PUBLIC_KEY` | GH secret | Only together with a new keypair; old artifacts then need the old private key. |
| `DJANGO_SECRET_KEY` | Render env | Like JWT key: invalidates sessions/tokens. |

Rotation via Render env alone is never enough for the superuser (see table).

## Monitoring & alarms
- **Uptime** (`.github/workflows/uptime.yml`): every 30 min pings frontend,
  `/api/room-features/`, `/admin/login/` → email on failure. Known GH quirk:
  scheduled runs are occasionally dropped (best-effort); failure emails do work.
- **Backup** (`.github/workflows/backup.yml`): daily 03:23 UTC → email on failure.
  A red backup run is a P1: plaintext uploads are impossible (fail-closed), so
  red means Supabase or secrets are broken.
- **Sentry:** not installed. Backend errors live in ephemeral Render logs.

## Public demo account (README credentials)
- Seeded by `manage.py seed_demo` — creates org "Demo Workspaces" (slug
  `demo`), rooms, sample bookings, and members `demo-reviewer` /
  `demo-colleague` (role `member`, no admin rights).
- **Reset anytime** (keeps the README password working — the command reads
  `DEMO_PASSWORD`):
  ```bash
  # Against Supabase/prod (from backend/):
  DATABASE_URL='<supabase-uri>' DJANGO_SECRET_KEY=x \
    DEMO_PASSWORD='DemoOnly-Br4nd-New-2026' python manage.py seed_demo --reset
  ```
- Scheduled: `.github/workflows/demo-reset.yml` runs the same reset on the
  1st of each month (uses the `SUPABASE_DB_URL` secret, no new secrets).
- Only the org with slug `demo` is ever deleted — real orgs are untouched.
  If a reviewer joined the demo org via an invite key, their memberships are
  cascaded away with it; registered accounts in *their own* orgs are not.
- Local E2E runs (`npm run e2e`) each leave one disposable `e2e-*` org in the
  local DB — harmless, delete via Django admin if the list gets noisy.

## Known deferred items (do not "fix" blindly)
- `check --deploy` warns about `SECURE_HSTS_INCLUDE_SUBDOMAINS`/`PRELOAD` —
  intentionally off: the app is on shared platform domains (see settings.py).
- Throttling uses LocMemCache (per-process); real rate limiting needs Redis.
- JWT in localStorage; HttpOnly-cookie migration planned before user growth.
