// Captures REAL screenshots from a running RentManager app and saves them into
// docs/manual/site/img/ with the exact filenames the walkthroughs reference.
// When these real files exist they automatically replace the illustrated
// previews (just run: node docs/manual/site/build.mjs afterwards).
//
// Prerequisites (one time, on a machine with internet for binary downloads):
//   1. npm install && npx prisma generate && npx prisma migrate deploy && npm run db:seed
//   2. npx playwright install chromium
//   3. Start the app:  npm run dev   (Next.js on http://localhost:3000)
//
// Then run:
//   node docs/manual/site/capture-screenshots.mjs
//
// Set BASE_URL / LOGIN_EMAIL / LOGIN_PASSWORD env vars to override defaults.

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, "img");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const EMAIL = process.env.LOGIN_EMAIL || "staff@demo.test";
const PASSWORD = process.env.LOGIN_PASSWORD || "Demo1234!";

// filename → path (hash route) within the app. Use a staff account which has
// operational access without 2FA. Re-target paths if your build differs.
const SHOTS = [
  { file: "utilities.png", url: "/utilities", wait: "table, .card, input" },
  { file: "moves.png", url: "/moves", wait: "table, .card, h1" },
  { file: "maintenance.png", url: "/maintenance", wait: "table, .card, h1" },
  { file: "pos.png", url: "/pos", wait: "table, .card, button" },
  { file: "telegram.png", url: "/telegram", wait: ".card, h1, form" }
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  console.log(`→ Signing in as ${EMAIL} at ${BASE}`);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"], button:has-text("Sign in"), button:has-text("Log in")');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);

  for (const s of SHOTS) {
    try {
      await page.goto(`${BASE}${s.url}`, { waitUntil: "networkidle" }).catch(() => {});
      await page.waitForTimeout(1800);
      const target = path.join(outDir, s.file);
      // Screenshot the main content area if present, else full page.
      const el = await page.$("main, [role='main'], .prose, body");
      await el.screenshot({ path: target }).catch(async () => {
        await page.screenshot({ path: target, fullPage: true });
      });
      console.log(`✓ ${s.file}  (${s.url})`);
    } catch (e) {
      console.warn(`✗ ${s.file} (${s.url}): ${e.message.split("\n")[0]}`);
    }
  }

  await browser.close();
  console.log("\nDone. Rebuild the guide: node docs/manual/site/build.mjs");
}

main();
