/**
 * admin.test.js — Playwright automation for AdminDashboard
 *
 * Simulates manually filling and submitting the academy registration form.
 *
 * SETUP (run once):
 *   npm install -D @playwright/test
 *   npx playwright install chromium
 *
 * RUN:
 *   npx playwright test admin.test.js --headed
 */

import { test } from "@playwright/test";

// ── CONFIG — edit before running ──────────────────────────────────────────────
const CONFIG = {
  adminEmail:    "admin1@gmail.com",
  adminPassword: "Ekalavya",

  academy: {
    name:           "Greenwood Academy",
    founder:        "Dr. Ramesh Kumar",
    year:           "2010",
    address:        "123, MG Road, Bengaluru, Karnataka - 560001",
    googleBusiness: "https://business.google.com/test",  // leave empty string to skip
  },

  employees: [
    { name: "Arjun Sharma", dob: "1990-05-14", gender: "male",   role: "mentor"             },
    { name: "Priya Nair",   dob: "1988-11-22", gender: "female", role: "content_management" },
    { name: "Ravi Verma",   dob: "1985-03-08", gender: "male",   role: "conflict_resolution"},
    // Add more mentors here if needed:
    // { name: "Meena Iyer", dob: "1993-07-30", gender: "female", role: "mentor" },
  ],
};
// ─────────────────────────────────────────────────────────────────────────────

test("fill and submit academy registration", async ({ page }) => {

  // ── 1. Open admin page ────────────────────────────────────────────────────
  await page.goto("http://localhost:5173/admin");

  // ── 2. Sign in ────────────────────────────────────────────────────────────
  // ── 2. Sign in via login page ─────────────────────────────────────────────
  await page.goto("http://localhost:5173/login");

  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]',    CONFIG.adminEmail);
  await page.fill('input[type="password"]', CONFIG.adminPassword);
  await page.click('button[type="submit"]');

  // Wait for login to complete — Firebase needs a moment to settle
  await page.waitForTimeout(3000);

  // Manually navigate to admin since there's no automatic redirect
  await page.goto("http://localhost:5173/admin");

  // Wait for the admin sidebar to confirm access
  await page.waitForSelector(".admin-sidebar", { timeout: 10000 });

  // ── 3. Fill academy details ───────────────────────────────────────────────
  await page.fill('input[placeholder*="Greenwood"]',       CONFIG.academy.name);
  await page.fill('input[placeholder*="Ramesh"]',          CONFIG.academy.founder);
  await page.fill('input[type="number"]',                  CONFIG.academy.year);
  await page.fill("textarea",                              CONFIG.academy.address);

  if (CONFIG.academy.googleBusiness) {
    await page.fill('input[placeholder*="business.google"]', CONFIG.academy.googleBusiness);
  }

  // ── 4. Draw a squiggle on the signature canvas ────────────────────────────
  const canvas = page.locator(".admin-sig-canvas");
await canvas.scrollIntoViewIfNeeded();
const box = await canvas.boundingBox();

// Slow the mouse down so strokes actually register on the canvas context
await page.mouse.move(box.x + 20, box.y + box.height / 2);
await page.mouse.down();
for (let i = 0; i <= 220; i += 8) {
await page.mouse.move(
    box.x + 20 + i,
    box.y + box.height / 2 + Math.sin(i / 18) * 22,
    { steps: 3 }   // interpolates movement so canvas registers each stroke
);
}
await page.mouse.up();

// Give React a moment to flush the state update from onMouseUp
await page.waitForTimeout(300);

  // ── 5. Fill employees ─────────────────────────────────────────────────────
  // The form starts with 3 cards (mentor, cm, cr). Fill those first.
  for (let i = 0; i < Math.min(CONFIG.employees.length, 3); i++) {
    await fillEmployeeCard(page, i, CONFIG.employees[i]);
  }

  // If there are extra employees beyond the initial 3, add and fill them
  for (let i = 3; i < CONFIG.employees.length; i++) {
    await page.click(".admin-add-emp-btn");
    await page.waitForTimeout(300);
    await fillEmployeeCard(page, i, CONFIG.employees[i]);
  }

  // ── 6. Submit ─────────────────────────────────────────────────────────────
  await page.click(".admin-submit-btn");

  // ── 7. Wait for credentials modal ────────────────────────────────────────
  await page.waitForSelector("text=Registration Complete", { timeout: 30000 });

  // Pauses here so you can read and note down the credentials.
  // Click the resume button in the Playwright inspector to continue.
  await page.pause();

});

// ── Helper: fill a single employee card by index ──────────────────────────────
async function fillEmployeeCard(page, idx, emp) {
  const card = page.locator(".admin-emp-card").nth(idx);

  await card.locator('[data-id="name"]').fill(emp.name);
  await card.locator('input[type="date"]').fill(emp.dob);

  // First select = gender, second = role
  await card.locator("select").first().selectOption(emp.gender);
  await card.locator("select").nth(1).selectOption(emp.role);
}