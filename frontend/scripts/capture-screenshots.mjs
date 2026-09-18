/**
 * Capture README screenshots from the real app, logged in as the demo user.
 *
 * Prerequisites:
 *   1. Full stack running:      docker compose up -d
 *   2. Demo data seeded:        docker compose exec backend python manage.py seed_demo
 *   3. Playwright chromium:     npx playwright install chromium
 *
 * Run from frontend/:
 *   DEMO_PASSWORD=... npm run screenshots
 *
 * Output: docs/screenshots/*.png (repo root)
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:5173";
const USERNAME = process.env.DEMO_USERNAME ?? "demo-reviewer";
const PASSWORD = process.env.DEMO_PASSWORD;
const OUT_DIR = path.resolve(process.cwd(), "../docs/screenshots");

if (!PASSWORD) {
  console.error(
    "DEMO_PASSWORD is required (the one passed to manage.py seed_demo)."
  );
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2, // crisp on retina — README renders them ~half size
});
const page = await context.newPage();

const shot = async (name) => {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400); // let transitions/skeletons settle
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
  console.log(`✓ ${name}.png`);
};

try {
  // Log in as the demo user
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Username").fill(USERNAME);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await shot("home");

  // Rooms list (desktop viewport → Primary top nav)
  const primaryNav = page.getByRole("navigation", { name: "Primary" });
  await primaryNav.getByRole("button", { name: "Rooms" }).click();
  await page.getByRole("button", { name: "Book this room" }).first().waitFor();
  await shot("rooms");

  // Booking sheet with date picker + open slots
  await page.getByRole("button", { name: "Book this room" }).first().click();
  await page.getByRole("heading", { name: "Book Room" }).waitFor();
  await shot("booking");
  await page.locator('[aria-label="Close"]').click();

  // Calendar month grid with busy chips (today shows past + current)
  await primaryNav.getByRole("button", { name: "Calendar" }).click();
  await page.getByRole("heading", { name: "Calendar" }).waitFor();
  const today = page.locator("div.cursor-pointer.bg-white");
  await today.waitFor({ timeout: 15_000 });
  await shot("calendar");

  // Expanded day: past, current ("Now"), and — on other days — cancelled
  await today.click();
  await page.getByRole("heading", { name: /\w+ \d{1,2}, \d{4}/ }).waitFor();
  await shot("calendar-day");

  // Profile with booking history (ongoing / completed / cancelled)
  await primaryNav.getByRole("button", { name: "Profile" }).click();
  await page.getByRole("heading", { name: "Profile", exact: true }).waitFor();
  await shot("profile");

  console.log(`\nSaved to ${OUT_DIR}`);
} finally {
  await browser.close();
}
