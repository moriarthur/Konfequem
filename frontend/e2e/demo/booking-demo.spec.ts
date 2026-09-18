import { expect, type Page, test } from "@playwright/test";

/**
 * Scripted product demo (NOT a regression test): drives the app through
 * the booking story with on-page captions so the recording works without
 * narration. Recorded by scripts/record-demo.sh via
 * playwright.demo.config.ts (video on, slowMo).
 *
 * Requires the local Docker stack + freshly seeded demo data
 * (seed_demo --reset) so the "Happening now" booking is really now.
 */

const DEMO_PASSWORD = process.env.DEMO_PASSWORD;

async function caption(page: Page, text: string): Promise<void> {
  await page.evaluate((t) => {
    let el = document.getElementById("demo-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-caption";
      document.body.appendChild(el);
    }
    el.setAttribute(
      "style",
      "position:fixed;bottom:28px;left:50%;transform:translateX(-50%);" +
        "z-index:9999;background:rgba(1,53,44,0.94);color:#fff;" +
        "padding:12px 26px;border-radius:14px;" +
        "font:600 19px/1.3 system-ui,sans-serif;" +
        "box-shadow:0 10px 28px rgba(0,0,0,0.28);white-space:nowrap;"
    );
    el.textContent = t;
  }, text);
}

const beat = (page: Page, ms: number) => page.waitForTimeout(ms);

test("record the product demo", async ({ page }) => {
  if (!DEMO_PASSWORD) {
    throw new Error("DEMO_PASSWORD is required (pass it to record-demo.sh)");
  }

  // Scene 0 — brand + login
  await page.goto("/login");
  await caption(page, "Konfequem — multi-tenant room booking");
  await beat(page, 2200);
  await page.getByLabel("Username").fill("demo-reviewer");
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await caption(page, "Your day at a glance");
  await beat(page, 2400);

  // Scene 1 — rooms
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("button", { name: "Rooms" })
    .click();
  await page.getByText("Aurora").first().waitFor();
  await caption(page, "1 · Browse available rooms");
  await beat(page, 2600);

  // Scene 2 — booking sheet
  await page.getByRole("button", { name: "Book this room" }).first().click();
  await expect(page.getByRole("heading", { name: "Book Room" })).toBeVisible();
  await caption(page, "2 · Pick a date, a free slot and a duration");
  // Remember which day gets booked: late in the evening "first enabled"
  // is tomorrow, and scene 4 must open exactly that calendar day.
  const dayButton = page.locator(".rdp-day button:not([disabled])").first();
  const dayLabel = (await dayButton.getAttribute("aria-label")) ?? "";
  const dayNumber = dayLabel.match(/(\d{1,2})(?:st|nd|rd|th),/)?.[1] ?? "";
  await dayButton.click();
  await page
    .getByRole("button", { name: /Morning|Afternoon|Evening/ })
    .first()
    .click();
  await page.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first().click();
  // Prefer a 30-minute booking when the slot allows it; the slot click
  // already preselected 15 min as the fallback.
  await page
    .getByRole("button", { name: "30 min" })
    .click({ timeout: 2500 })
    .catch(() => {});
  await beat(page, 1600);

  // Scene 3 — submit
  await caption(page, "3 · Booking rules are validated server-side");
  await page.getByRole("button", { name: "Book a Room" }).click();
  await expect(
    page.getByText("Your booking was created successfully")
  ).toBeVisible({ timeout: 15_000 });
  await beat(page, 2200);

  // Scene 4 — calendar, expanded on the exact day that was booked
  await page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("button", { name: "Calendar" })
    .click();
  await page.getByRole("heading", { name: "Calendar" }).waitFor();
  const bookedDay = page
    .locator("div.cursor-pointer")
    .filter({ has: page.locator(`span:text-is("${dayNumber}")`) })
    .first();
  await bookedDay.waitFor({ timeout: 20_000 });
  await bookedDay.click();
  await page
    .getByRole("heading", { name: /\w+ \d{1,2}, \d{4}/ })
    .waitFor();
  await caption(page, "4 · The reservation appears in the calendar");
  await beat(page, 3200);

  // End card
  await caption(page, "konfequem.netlify.app — try it live");
  await beat(page, 2600);
});
