#!/usr/bin/env bash
# Record the scripted product demo end to end:
#   1. bring up the Docker stack and reseed the demo data (so the
#      "Happening now" booking is really happening now),
#   2. run the Playwright demo scenario (video + on-page captions),
#   3. convert the raw WebM into an optimized README GIF and an MP4
#      for Release/YouTube uploads.
#
# Usage:  DEMO_PASSWORD=... bash scripts/record-demo.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DEMO_PASSWORD=${DEMO_PASSWORD:?"set DEMO_PASSWORD (the one passed to manage.py seed_demo)"}

# 1. Stack + fresh demo data
docker compose up -d --wait 2>/dev/null || docker compose up -d
# -e is required: exec does not inherit host env, and without the password
# the seed would silently generate a random one the demo can't log in with.
docker compose exec -T -e DEMO_PASSWORD="$DEMO_PASSWORD" backend \
  python manage.py seed_demo --reset

# 2. Record (WebM lands in demo-output/raw/)
rm -rf demo-output/raw
npx playwright test --config playwright.demo.config.ts

RAW=$(find demo-output/raw -name "*.webm" -printf "%T@ %p\n" | sort -nr | head -1 | cut -d" " -f2-)
mkdir -p demo-output ../docs/screenshots

# 3a. MP4 — for GitHub Release / YouTube
ffmpeg -y -loglevel error -i "$RAW" \
  -c:v libx264 -pix_fmt yuv420p -crf 23 -movflags +faststart \
  demo-output/demo.mp4

# 3b. GIF — autoplays inline in the README (10 fps, 960px, tuned palette)
ffmpeg -y -loglevel error -i "$RAW" \
  -vf "fps=10,scale=960:-2:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=5" \
  -loop 0 demo-output/demo.gif
gifsicle -O3 --lossy=80 -o demo-output/demo.opt.gif demo-output/demo.gif

cp demo-output/demo.opt.gif ../docs/screenshots/demo.gif

echo
ls -lh demo-output/demo.mp4 ../docs/screenshots/demo.gif
echo "README GIF: docs/screenshots/demo.gif"
