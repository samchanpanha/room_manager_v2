# RentManager Guide — Web version

A self-contained, single-page web version of the manual in this folder.

## Open it
- **Standalone:** open `index.html` in any browser (no server needed — content
  and images are embedded), or run `python3 -m http.server 8099` in this folder.
- **Inside RentManager:** the builder also publishes the guide to
  `public/guide/`, so with the app running it is available in-app at **`/guide`**
  (a "Help & Guide" item appears in the sidebar's Account group). This works
  without a database — it is a static page.

## What's inside
- **🏠 Home** — illustrated landing page linking every part.
- **Sidebar** — the 13 parts grouped by audience.
- **🧭 Step-by-step Workflows** — 14 guided, click-through walkthroughs with a
  progress bar, Next/Back/Restart, a 🧭 menu path and an illustrated screen
  preview on key steps:
  1. Set up a property & rooms · 2. Onboard a member · 3. Create a lease ·
  4. Generate invoices · 5. Receive a payment · 6. Move a member out ·
  7. Record an expense · 8. Owner statements · 9. Create a user ·
  10. **Read meters & bill utilities** · 11. **Move a resident to another room** ·
  12. **Handle a maintenance ticket** · 13. **Run a POS sale** ·
  14. **Set up the Telegram bot**.
- **17 diagrams** inline in the relevant sections (status machines, lifecycles,
  billing/payment flows, P&L and owner-statement math, admin setup).
- Responsive (mobile menu), printable, Khmer/Chinese-safe fonts.

## Rebuild after editing the manual or walkthroughs
```bash
node docs/manual/site/build.mjs
```
This regenerates `index.html` **and** republishes to `public/guide/`. Diagrams
and walkthroughs are defined in `build.mjs`; illustrations live in `img/`.

## Real screenshots (replacing the illustrated previews)
The walkthrough steps currently use AI **illustrated** screen previews
(badged "🖼️ Illustrated screen preview"). To swap in **real** screen captures:

```bash
# one-time, on a machine that can download binaries:
npm install && npx prisma generate && npx prisma migrate deploy && npm run db:seed
npx playwright install chromium
npm run dev                     # app on http://localhost:3000
node docs/manual/site/capture-screenshots.mjs
node docs/manual/site/build.mjs # rebuild — real files auto-override previews
```

`capture-screenshots.mjs` signs in (default `staff@demo.test`), visits each
module, and saves `img/utilities.png`, `img/moves.png`, `img/maintenance.png`,
`img/pos.png`, `img/telegram.png` — the exact filenames referenced by the
walkthroughs. Override target/credentials with `BASE_URL`, `LOGIN_EMAIL`,
`LOGIN_PASSWORD`.
