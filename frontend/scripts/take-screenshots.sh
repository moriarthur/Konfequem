#!/usr/bin/env bash
# Refresh the six README screenshots from the real app.
# Wrapper around scripts/capture-screenshots.mjs — ensures the stack is
# up and the demo data is fresh before shooting.
#
# Usage:  DEMO_PASSWORD=... bash scripts/take-screenshots.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DEMO_PASSWORD=${DEMO_PASSWORD:?"set DEMO_PASSWORD (the one passed to manage.py seed_demo)"}

docker compose up -d --wait 2>/dev/null || docker compose up -d
# -e is required: exec does not inherit host env (same as record-demo.sh).
docker compose exec -T -e DEMO_PASSWORD="$DEMO_PASSWORD" backend \
  python manage.py seed_demo --reset

DEMO_PASSWORD="$DEMO_PASSWORD" npm run screenshots
