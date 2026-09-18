import { test, expect } from "@playwright/test";

/**
 * Happy-path booking flow: register an org → create a room → book a slot
 * → verify the booking shows up on the calendar.
 *
 * Self-contained: registration creates a fresh org_admin with a unique
 * slug, so the test never depends on seeded data and leaves its own
 * disposable org behind instead of touching the demo org.
 */

const unique = Date.now().toString(36);
const orgSlug = `e2e-${unique}`;
const username = `e2e${unique}`.slice(0, 20);
const password = "xK9mP2vLq8wZ4nR7";
const roomName = `E2E Room ${unique.slice(-4)}`;

test("booking happy path: register org, create room, book slot, see it on the calendar", async ({
  page,
}) => {
  // --- 1. Register org + org_admin -------------------------------------
  await page.goto("/register");
  await page.getByLabel("Organization name").fill("E2E Test Org");
  await page.getByLabel("Organization slug").fill(orgSlug);
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(`${orgSlug}@example.com`);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create Organization" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  // --- 2. Create a room (org admins see "+ Add Room") -------------------
  await page.locator('[aria-label="Rooms"]').click();
  await page.getByRole("button", { name: "+ Add Room" }).click();
  await page.getByLabel("Room name").fill(roomName);
  await page.getByLabel("Location", { exact: false }).fill("Floor 1");
  await page.getByLabel("Capacity").fill("6");
  await page.getByRole("button", { name: "Add Room", exact: true }).click();
  await expect(page.getByText(roomName).first()).toBeVisible();

  // --- 3. Book a slot ----------------------------------------------------
  await page.getByRole("button", { name: "Book this room" }).click();
  await expect(page.getByRole("heading", { name: "Book Room" })).toBeVisible();

  // First enabled day in the picker = today (past days are disabled; today
  // only becomes disabled late in the evening, in which case this is
  // tomorrow — still within the current month for the calendar check).
  await page.locator(".rdp-day button:not([disabled])").first().click();

  // Only periods with open slots render; the room is brand new, so its
  // first rendered slot is available. Clicking a slot preselects 15 min.
  await page.getByRole("button", { name: /Morning|Afternoon|Evening/ }).first().click();
  await page.getByRole("button", { name: /^\d{2}:\d{2}$/ }).first().click();

  await page.getByRole("button", { name: "Book a Room" }).click();
  await expect(
    page.getByText("Your booking was created successfully")
  ).toBeVisible({ timeout: 10_000 });

  // --- 4. The booking appears on the calendar ----------------------------
  await page.locator('[aria-label="Calendar"]').click();
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();

  // Today's cell gets a busy chip (time + room name) once availability loads.
  await expect(page.getByText(roomName).first()).toBeVisible({ timeout: 15_000 });
  await page.locator("div.cursor-pointer.bg-white").click(); // today's cell → expanded day
  await expect(page.getByRole("heading", { name: /\w+ \d{1,2}, \d{4}/ })).toBeVisible();
  await expect(page.getByText(roomName).first()).toBeVisible();
});
