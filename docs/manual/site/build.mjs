// Builds a self-contained single-page documentation site from the manual .md files.
// Run: node docs/manual/site/build.mjs   ->   docs/manual/site/index.html
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const manualDir = path.resolve(here, "..");

const PARTS = [
  { file: "01-system-overview.md", label: "System Overview", group: "Start" },
  { file: "02-quick-start.md", label: "Quick Start", group: "Start" },
  { file: "03-user-guide.md", label: "User Guide", group: "Using RentManager" },
  { file: "04-business-workflows.md", label: "Business Workflows", group: "Using RentManager" },
  { file: "05-financial-accounting-guide.md", label: "Financial & Accounting", group: "Finance & Insights" },
  { file: "06-reports-guide.md", label: "Reports", group: "Finance & Insights" },
  { file: "07-telegram-notifications.md", label: "Telegram & Notifications", group: "Finance & Insights" },
  { file: "08-administrator-guide.md", label: "Administrator Guide", group: "Administration" },
  { file: "09-security-guide.md", label: "Security Guide", group: "Administration" },
  { file: "10-troubleshooting.md", label: "Troubleshooting", group: "Reference" },
  { file: "11-faq.md", label: "FAQ", group: "Reference" },
  { file: "12-glossary.md", label: "Glossary", group: "Reference" },
  { file: "13-golden-paths.md", label: "Golden Paths & Scenarios", group: "Reference" }
];

const fileSlug = (f) => f.replace(/\.md$/, "");
const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s) {
  // order: inline code, bold, italic, links
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  // links [text](href)  — rewrite .md links to internal routes
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, href) => {
    const mm = href.match(/^(\d{2}-[a-z0-9-]+)\.md(?:#(.*))?$/);
    if (mm) {
      const target = mm[1];
      const frag = mm[2] ? `#sec-${target}-${mm[2]}` : "";
      return `<a href="#/part/${target}${frag}" class="inlink">${text}</a>`;
    }
    return `<a href="${esc(href)}" target="_blank" rel="noopener">${text}</a>`;
  });
  return s;
}

function table(rows) {
  const parse = (l) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const header = parse(rows[0]);
  const body = rows.slice(2).map(parse);
  let h = '<div class="table-wrap"><table><thead><tr>';
  for (const c of header) h += `<th>${inline(c)}</th>`;
  h += "</tr></thead><tbody>";
  for (const r of body) {
    h += "<tr>";
    for (const c of r) h += `<td>${inline(c)}</td>`;
    h += "</tr>";
  }
  h += "</tbody></table></div>";
  return h;
}

// ── Flow diagram builder (returns HTML) ──
function node(n, variant = "") {
  return `<div class="flow-node ${variant}">${n}</div>`;
}
function chain(items, opts = {}) {
  const horiz = opts.horiz ? " flow-h" : "";
  const arrow = opts.horiz ? '<div class="flow-arrow flow-arrow-h">→</div>' : '<div class="flow-arrow">↓</div>';
  return `<div class="flow${horiz}">${items
    .map((it, i) => {
      const [txt, v] = typeof it === "string" ? [it, ""] : [it.t, it.v || ""];
      return node(txt, v) + (i < items.length - 1 ? arrow : "");
    })
    .join("")}</div>`;
}
function formula(title, rows) {
  return `<div class="formula"><div class="formula-title">${title}</div>${rows
    .map((r, i) => `<div class="formula-row">${inline(r)}</div>${i === rows.length - 2 ? '<div class="formula-rule"></div>' : ""}`)
    .join("")}</div>`;
}

const DIAGRAMS = {
  "01-system-overview": {
    "14-how-the-system-works-the-end-to-end-lifecycle": () =>
      `<figure class="diagram"><figcaption>End-to-end lifecycle — how information moves</figcaption>
      ${chain([
        { t: "Sign in → Dashboard", v: "v-blue" },
        "Property → Building → Floor → Room (price &amp; status)",
        "Owner + Owner contract",
        { t: "Member profile + KYC (prospect → verified)", v: "v-green" },
        { t: "Lease activated — room occupied, deposit billed, services on", v: "v-green" },
        "Monthly billing job → Invoice (rent + services + utilities)",
        { t: "Member pays (QR / cash / bank / card) → Receipt", v: "v-amber" },
        "Ledger posts balanced entries (append-only)",
        "Expenses · POS sales · stock movements",
        { t: "Profit &amp; Loss → Owner statement → paid", v: "v-teal" },
        "Reports · dashboard KPIs · Telegram"
      ])}
      </figure>`,
    "15-key-relationships-between-modules": () =>
      `<figure class="diagram"><figcaption>The hierarchy everything hangs off</figcaption>
      ${chain([
        "Property",
        "Building (owned by one Owner)",
        "Floor",
        "Room",
        "Beds · Meters · Leases · Tickets",
        { t: "Lease → Invoices → Payments → Ledger", v: "v-teal" }
      ], { horiz: false })}
      </figure>`
  },
  "03-user-guide": {
    "1-authentication-login": () =>
      `<figure class="diagram"><figcaption>Signing in</figcaption>
      ${chain([
        "Open login · pick language (English / ខ្មែរ / 中文)",
        "Email + password",
        "2FA code? (required for Admin+)",
        { t: "First login? Set a new password", v: "v-amber" },
        { t: "Dashboard 🎉", v: "v-green" }
      ])}
      </figure>`,
    "3-properties-rooms-m04": () =>
      `<figure class="diagram"><figcaption>Room status machine</figcaption>
      ${chain([
        { t: "vacant", v: "v-green" },
        "reserved (draft lease)",
        { t: "occupied (lease active)", v: "v-blue" },
        "cleaning (after move-out)",
        "maintenance (reason required)",
        { t: "back to vacant", v: "v-green" }
      ], { horiz: true })}
      </figure>`,
    "4-members-m02-documents-m17": () =>
      `<figure class="diagram"><figcaption>Member lifecycle</figcaption>
      ${chain([
        { t: "prospect", v: "v-amber" },
        "KYC complete → verified",
        "lease active → active",
        "notice given",
        { t: "moved_out", v: "v-blue" }
      ], { horiz: true })}
      </figure>`,
    "6-leases-contracts-m05": () =>
      `<figure class="diagram"><figcaption>Lease lifecycle &amp; its effects</figcaption>
      ${chain([
        { t: "draft — reserves the room", v: "v-amber" },
        { t: "activate — room = occupied · member = active · deposit billed · first invoice scheduled", v: "v-green" },
        "notice (move-out)",
        { t: "terminate / complete — room = cleaning · member = moved_out · deposit settlement", v: "v-blue" }
      ])}
      </figure>`,
    "10-invoices-monthly-billing-m07": () =>
      `<figure class="diagram"><figcaption>An invoice's life</figcaption>
      ${chain([
        { t: "draft", v: "v-amber" },
        "issued (immutable · gapless number · PDF filed)",
        "partial_paid",
        { t: "paid", v: "v-green" },
        "overdue (after grace) / void (Super Admin + reason)"
      ], { horiz: true })}
      </figure>`,
    "11-payments-receipts-m09": () =>
      `<figure class="diagram"><figcaption>Payment lifecycle</figcaption>
      ${chain([
        { t: "pending", v: "v-amber" },
        "confirmed → allocated oldest-first → receipt RCP-… → ledger posts",
        { t: "refunded (Accountant+)", v: "v-blue" },
        "failed (no receipt / no ledger impact)"
      ])}
      </figure>`,
    "13-deposits-m10": () =>
      `<figure class="diagram"><figcaption>Deposit lifecycle (money held, not income)</figcaption>
      ${chain([
        "billed (installment invoices at activation)",
        "held in 2100 Deposit Liability",
        { t: "settled: deductions (evidence) + refund (Accountant approval)", v: "v-teal" },
        "liability nets to 0 for the closed lease"
      ])}
      </figure>`,
    "18-pos-m14": () =>
      `<figure class="diagram"><figcaption>POS register session</figcaption>
      ${chain([
        "Open session (opening float)",
        "Sell — cash / QR / card / charge to room",
        "Stock decrements · receipt PDF filed",
        { t: "Close session — count cash → variance recorded", v: "v-amber" }
      ])}
      </figure>`
  },
  "04-business-workflows": {
    "41-the-tenant-lifecycle-move-in-move-out": () =>
      `<figure class="diagram"><figcaption>The full resident journey</figcaption>
      ${chain([
        "Prospect → Member (M02)",
        "KYC uploads complete → verified (M17)",
        "Lease draft → ACTIVE (room occupied, deposit billed) (M05/M10)",
        "Monthly living: invoices · payments · meters · tickets · moves",
        "Notice given · dues cleared to 0",
        "Move-out inspection completed (hard gate) (M18)",
        { t: "Lease terminated — room cleaning · deposit settled (M10)", v: "v-teal" },
        "Room → vacant, ready to re-let"
      ])}
      </figure>`,
    "42-billing-workflow-monthly-close-rhythm": () =>
      `<figure class="diagram"><figcaption>Monthly close rhythm</figcaption>
      ${chain([
        "1 · Enter meter readings (M11)",
        "2 · Log per-use services (M12) · 3 · POS room charges (M14)",
        { t: "4 · RUN invoice generation (idempotent, gapless) (M06/M07)", v: "v-green" },
        "5 · Spot-check totals",
        "6 · Issue invoices → portal + Telegram",
        "Daily job: late fees → overdue → dunning +3/+7/+14",
        { t: "Collect → receipts → ledger", v: "v-amber" }
      ])}
      </figure>`,
    "43-payment-workflow": () =>
      `<figure class="diagram"><figcaption>From payment to books</figcaption>
      ${chain([
        "Member pays (QR in portal / cash / bank / card / cheque)",
        "Cash/bank = confirmed · QR/card = pending → webhook (once)",
        "Allocated oldest-first; deposit first; overpay → member credit",
        { t: "Invoice partial_paid/paid · receipt filed · ledger posts · Telegram receipt", v: "v-teal" }
      ])}
      </figure>`,
    "48-owner-statement-workflow": () =>
      `<figure class="diagram"><figcaption>Owner statement → payout</figcaption>
      ${chain([
        "Generate (idempotent per contract+month) — Accountant+",
        "collected × share% (or fixed rent) − fees − costs ± adjustments",
        { t: "draft → approved  (DR 3900 · CR 2200)", v: "v-amber" },
        { t: "paid (DR 2200 · CR cash/bank) · PDF filed → owner portal", v: "v-green" }
      ])}
      </figure>`
  },
  "05-financial-accounting-guide": {
    "55-profit-loss-pl": () =>
      `<figure class="diagram"><figcaption>Profit &amp; Loss in one picture</figcaption>
      ${formula("Net profit = Revenue − Expenses − Owner payout", [
        "**Revenue** — rent (4000) + services (4100) + utilities (4200) + late fees (4300) + other/POS (4900)",
        "**− Expenses** — operating (5000) + bank fees (5100)",
        "**− Owner payout** — per the owner contract",
        "= **Net profit / loss** for the period"
      ])}
      </figure>`,
    "57-owner-statements-m24-owner-payouts": () =>
      `<figure class="diagram"><figcaption>What an owner is paid</figcaption>
      ${formula("Net owner payout", [
        "Money **collected** for the owner's units",
        "× owner **share %**  (or fixed monthly master rent)",
        "− **management fee** − pass-through expenses − owner-borne maintenance",
        "± **approved adjustments** (audited)",
        "= **Net owner payout**"
      ])}
      </figure>`
  },
  "08-administrator-guide": {
    "87-admin-golden-path-initial-setup-order": () =>
      `<figure class="diagram"><figcaption>Setup order for a new system</figcaption>
      ${chain([
        "1 · Company / locale (currency, timezone, language)",
        "2 · Properties → buildings → floors → rooms",
        "3 · Roles · 4 · Users (assign roles + properties)",
        "5 · Rent engine · 6 · Opening balances",
        "7 · Payment methods &amp; provider secrets",
        "8 · Billing / dunning / rent alerts",
        "9 · Owners + contracts + payout methods",
        "10 · Notifications + Telegram bot",
        "11 · Security (2FA, sessions, backups)",
        "12 · Feature flags + reports",
        { t: "13 · Test golden path · 14 · Review audit log · backup", v: "v-green" }
      ])}
      </figure>`
  }
};

function convert(md, partSlug) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let out = [];
  let i = 0;
  let toc = [];
  let h2Index = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    if (line.trim().startsWith("```")) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { buf.push(lines[i]); i++; }
      i++;
      out.push(`<pre class="code">${esc(buf.join("\n"))}</pre>`);
      continue;
    }
    // table
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i]); i++; }
      out.push(table(rows));
      continue;
    }
    // headings
    const hm = line.match(/^(#{1,4})\s+(.*)$/);
    if (hm) {
      const level = hm[1].length;
      const text = hm[2].trim();
      const slug = slugify(text);
      if (level === 2) {
        h2Index++;
        toc.push({ n: h2Index, slug, text });
        out.push(`<h2 id="sec-${partSlug}-${slug}"><span class="sec-no">${h2Index}</span>${inline(text)}</h2>`);
        // Diagram lookup: try full slug first, then match by trailing words
        // (heading numbers like "13." vary across key styles).
        const table = DIAGRAMS[partSlug];
        let diag = table && table[slug];
        if (!diag && table) {
          const words = slug.replace(/^\d+-/, "");
          const key = Object.keys(table).find((k) => slug === k || slug.endsWith(k.replace(/^\d+-/, "")) || k.endsWith(words));
          if (key) diag = table[key];
        }
        if (diag) out.push(diag());
      } else if (level === 1) {
        out.push(`<h1 class="part-title">${inline(text)}</h1>`);
      } else if (level === 3) {
        out.push(`<h3 id="sec-${partSlug}-${slug}">${inline(text)}</h3>`);
      } else {
        out.push(`<h4>${inline(text)}</h4>`);
      }
      i++;
      continue;
    }
    // hr
    if (/^\s*---+\s*$/.test(line)) { out.push('<hr class="soft">'); i++; continue; }
    // blockquote
    if (/^\s*>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      const joined = buf.join(" ").trim();
      const cls = joined.startsWith("🚫") ? "note note-danger" : joined.startsWith("⚠️") ? "note note-warn" : "note";
      out.push(`<aside class="${cls}">${inline(joined)}</aside>`);
      continue;
    }
    // list
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
        items.push(lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, ""));
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</${tag}>`);
      continue;
    }
    // blank
    if (line.trim() === "") { i++; continue; }
    // paragraph (gather until blank/special)
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,4})\s/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*\|.*\|\s*$/.test(lines[i]) &&
      !lines[i].trim().startsWith("```") &&
      !/^\s*---+\s*$/.test(lines[i])
    ) { buf.push(lines[i]); i++; }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return { html: out.join("\n"), toc };
}

function dataUri(p) {
  const b64 = fs.readFileSync(p).toString("base64");
  return `data:image/png;base64,${b64}`;
}

const img = {
  hero: dataUri(path.join(here, "img/hero.png")),
  tenant: dataUri(path.join(here, "img/tenant-mobile.png")),
  admin: dataUri(path.join(here, "img/admin-security.png"))
};

const parts = PARTS.map((p) => {
  const md = fs.readFileSync(path.join(manualDir, p.file), "utf8");
  const slug = fileSlug(p.file);
  const { html, toc } = convert(md, slug);
  return { ...p, slug, html, toc };
});

const walkthroughs = [
  {
    id: "property",
    title: "🏠 Set up a property & rooms",
    role: "Admin / Property Manager",
    time: "~15 min",
    intro: "Create the physical inventory before any leases can start.",
    steps: [
      { t: "Open Portfolio → Properties", d: "Click **Properties** in the sidebar, then **New property**.", menu: "Portfolio → Properties" },
      { t: "Enter the property", d: "Add a unique **code**, name and address. Optional: map coordinates + geofence radius for attendance.", menu: "Properties → New" },
      { t: "Add a building", d: "Open the property and **add a building** (e.g. Building A). Link its **owner** if known.", menu: "Property → Building" },
      { t: "Add a floor", d: "Add a floor with a name and level number.", menu: "Building → Floor" },
      { t: "Add rooms (use the bulk wizard)", d: "Use **bulk create**: prefix, start number, count, beds per room, type (STANDARD/DELUXE/STUDIO/SUITE) and base price.", menu: "Floor → Rooms → Bulk" },
      { t: "Verify the room grid", d: "Rooms show as **vacant** and occupancy stats update on the dashboard.", menu: "Properties → room grid" }
    ]
  },
  {
    id: "member",
    title: "🧑‍💼 Onboard a member (tenant)",
    role: "Staff / Manager",
    time: "~10 min",
    intro: "Register a resident and complete their KYC so they can sign a lease.",
    steps: [
      { t: "Open Members → New member", d: "Start the 4-step onboarding wizard.", menu: "Portfolio → Members → New" },
      { t: "Personal details", d: "Enter name, type (person/company), email and phone.", menu: "Wizard step 1" },
      { t: "Property & emergency contacts", d: "Assign the property; add an emergency contact name/phone.", menu: "Wizard step 2" },
      { t: "Upload KYC documents", d: "Upload ID/passport and all required document types; set **expiry dates**.", menu: "Wizard step 3" },
      { t: "Review & save", d: "Member is saved as **prospect**.", menu: "Wizard step 4" },
      { t: "Complete KYC → verified", d: "When the KYC checklist is complete the member becomes **verified** and can be leased. A dues badge will show any balance later.", menu: "Members → profile" }
    ]
  },
  {
    id: "lease",
    title: "📝 Create & activate a lease",
    role: "Manager",
    time: "~10 min",
    intro: "Put a verified member into a vacant room. Activation is what starts billing.",
    steps: [
      { t: "Open Leases → New", d: "Go to `/leases/new` (or start from the member/room).", menu: "Portfolio → Leases → New" },
      { t: "Choose member + room/bed", d: "Pick a **verified** member and a **vacant** room/bed.", menu: "Lease form" },
      { t: "Set the rent terms", d: "Start/end dates, rent amount, **cycle day** (1–28) and **proration basis** (calendar or 30-day).", menu: "Lease form" },
      { t: "Set deposit & services", d: "Deposit total + installments; add services (WiFi, parking…); set notice days / auto-renew.", menu: "Lease form" },
      { t: "Save as draft", d: "The room becomes **reserved**; review the terms.", menu: "Lease → draft" },
      { t: "Activate", d: "On **activate**: room → **occupied**, member → **active**, deposit is billed, first invoice is scheduled, contract PDF filed.", menu: "Lease → Activate" }
    ]
  },
  {
    id: "billing",
    title: "🧾 Generate the month's invoices",
    role: "Accountant / Manager",
    time: "~20 min (monthly)",
    intro: "Rent is billed automatically — you run the generation once per period.",
    steps: [
      { t: "Enter meter readings first", d: "In **Utilities**, enter electric/water/gas readings (manual or CSV). Check any >2× average spike flag.", menu: "Billing → Utilities" },
      { t: "Log per-use services", d: "Record laundry / visitor parking usage so they become one-time lines.", menu: "Billing → Services" },
      { t: "Run invoice generation", d: "On **Invoices**, click **Generate**. It bills every active lease, is idempotent (no duplicates) and gaplessly numbered `{PROP}-{YEAR}-{SEQ}`.", menu: "Billing → Invoices → Generate" },
      { t: "Spot-check totals", d: "Confirm total = Σ lines − discount + tax; mid-month leases get a prorated stub.", menu: "Invoices list" },
      { t: "Issue invoices", d: "Move drafts to **issued** — members see them in the portal and get a Telegram message.", menu: "Invoice → Issue" },
      { t: "Let late fees/reminders run", d: "After the grace period the daily job adds late fees, marks overdue and sends dunning at +3/+7/+14.", menu: "Automatic (jobs)" }
    ]
  },
  {
    id: "payment",
    title: "💵 Receive a payment & issue a receipt",
    role: "Cashier / Staff / Accountant",
    time: "~3 min",
    intro: "Record money collected against invoices.",
    steps: [
      { t: "Open Payments → New", d: "Start from **Payments** (or an invoice/member).", menu: "Billing → Payments → New" },
      { t: "Select the member", d: "Confirm identity; their open invoices are listed.", menu: "Payment form" },
      { t: "Enter amount & method", d: "Type the amount; choose **cash / bank_transfer / qr / card / cheque**.", menu: "Payment form" },
      { t: "Save", d: "Cash/bank confirm immediately. QR/card start **pending** and confirm via the gateway webhook (duplicates ignored).", menu: "Payment → Save" },
      { t: "Check the automatic results", d: "Money is allocated **oldest-first**; the invoice flips to **partial_paid/paid**; a receipt `RCP-…` PDF is filed; ledger posts; a Telegram receipt can be sent.", menu: "Payment detail" },
      { t: "Handle over/under payment", d: "Partial = remainder stays due. Overpayment = held as **member credit** (not income).", menu: "Automatic" }
    ]
  },
  {
    id: "moveout",
    title: "🚪 Move a member out & settle the deposit",
    role: "Manager / Accountant",
    time: "~20 min",
    intro: "End a lease correctly so the room can be re-let and the deposit settled.",
    steps: [
      { t: "Give notice", d: "Set the lease to **notice** once the member announces move-out.", menu: "Lease → Notice" },
      { t: "Clear the balance", d: "Ensure dues = 0 (collect, or get an approved write-off).", menu: "Member statement" },
      { t: "Complete the move-out inspection", d: "Run the **move-out inspection** checklist (pass/fail + photos). This is the hard gate to end the lease.", menu: "Operations → Inspections" },
      { t: "Resolve findings", d: "Damage findings can open a maintenance ticket or propose a deposit deduction.", menu: "Inspection findings" },
      { t: "Settle the deposit", d: "Deduct (with **evidence + reason**) and/or **refund** the remainder (Accountant approval, stored payout method). Liability nets to 0.", menu: "Billing → Deposits" },
      { t: "Terminate/complete the lease", d: "Room → **cleaning**, member → **moved_out**. Return the room to **vacant** when ready to re-let.", menu: "Lease → Terminate" }
    ]
  },
  {
    id: "expense",
    title: "🧾 Record an expense",
    role: "Staff / Accountant",
    time: "~5 min",
    intro: "Capture vendor costs so they hit the P&L.",
    steps: [
      { t: "Open Expenses → New", d: "Go to **Finance → Expenses & P&L**.", menu: "Finance → Expenses → New" },
      { t: "Fill the expense", d: "Vendor, category (maps to ledger 5000/5100), amount, date, payment method, property; attach the receipt.", menu: "Expense form" },
      { t: "Save", d: "Below **$500** it **auto-approves** and posts to the ledger immediately.", menu: "Expense → Save" },
      { t: "Above threshold? Wait for approval", d: "Amounts at/above $500 stay **pending** until an Accountant/Manager approves, then post.", menu: "Approval" },
      { t: "Mistake? Void — don't delete", d: "A wrong expense is **voided**, which posts reversal entries (history preserved).", menu: "Expense → Void" }
    ]
  },
  {
    id: "ownerstatement",
    title: "🤝 Generate & pay an owner statement",
    role: "Accountant",
    time: "~15 min (monthly)",
    intro: "Calculate what each landlord is paid for the month.",
    steps: [
      { t: "Confirm the owner contract", d: "Ensure the building has an active owner contract — FIXED_RENT or REVENUE_SHARE % + management fee + payout day.", menu: "Portfolio → Owners → Contracts" },
      { t: "Generate statements", d: "In **Owner Statements**, run **Generate** (Accountant+). Idempotent per contract+month.", menu: "Finance → Owner Statements → Generate" },
      { t: "Review the math", d: "Collected × share (or fixed rent) − management fee − pass-through/owner maintenance ± adjustments = net payout.", menu: "Statement detail" },
      { t: "Approve", d: "Approval accrues: DR 3900 Owner Distributions · CR 2200 Owner Payable.", menu: "Statement → Approve" },
      { t: "Pay", d: "Pay via the owner's payout method: DR 2200 · CR cash/bank; payable nets back down.", menu: "Statement → Pay" },
      { t: "Share with the owner", d: "A statement PDF is auto-filed and appears in the owner portal; the owner gets a Telegram notification.", menu: "Automatic" }
    ]
  },
  {
    id: "user",
    title: "🛡️ Create a user & set permissions",
    role: "Super Admin / Admin",
    time: "~10 min",
    intro: "Give a colleague access with the least privilege they need.",
    steps: [
      { t: "Open Users → New user", d: "Go to **Admin → Users**.", menu: "Admin → Users → New" },
      { t: "Enter name + email + temporary password", d: "The account is created with must-change-password; the user sets their own on first login.", menu: "User form" },
      { t: "Assign role(s)", d: "Pick a default role or a custom one. Permissions are the **union** of all roles.", menu: "User → roles" },
      { t: "Assign properties", d: "For PROPERTY-scoped roles (Manager/Staff), assign the property/ies they may see.", menu: "User → properties" },
      { t: "Need a bespoke role?", d: "In **Roles & Permissions**, tick the module × action × scope grid (e.g. a 'Cashier' with only payments write). Changes are audited.", menu: "Admin → Roles" },
      { t: "Confirm 2FA for admins", d: "Admin/Super Admin must enroll an authenticator before other modules work. Reset a lost 2FA from Security.", menu: "Security" }
    ]
  },
  {
    id: "meters",
    title: "🔌 Read meters & bill utilities",
    role: "Staff / Manager",
    time: "~15 min (monthly)",
    intro: "Turn electric/water/gas meter readings into charges that land on the next invoice.",
    steps: [
      { t: "Open Utilities", d: "Go to **Billing → Utilities**. Each room/building meter (elec/water/gas) is listed.", menu: "Billing → Utilities", shot: "utilities.png" },
      { t: "Enter the new reading", d: "Open a meter and enter the current reading in exact units. The system keeps the previous reading and computes the difference.", menu: "Meter → new reading" },
      { t: "Choose how to read", d: "Type a real **manual** reading, use **estimate** (average of last 3, flagged), or **CSV import** for many rooms at once.", menu: "Manual / Estimated / Import" },
      { t: "Apply the tariff", d: "Charges = consumption × tariff (tiered bands apply automatically).", menu: "Tariff" },
      { t: "Check anomaly flags", d: "A reading more than **2× the average** is flagged as a possible mis-read — verify before billing.", menu: "Anomaly badge" },
      { t: "Charges join the next invoice", d: "You don't bill meters directly. Utility charges attach to the **next invoice generation** cycle (run that in Invoices). They appear as utility lines.", menu: "Next invoice run" }
    ]
  },
  {
    id: "move",
    title: "🚪 Move a resident to another room",
    role: "Staff request → Manager approves",
    time: "~10 min",
    intro: "Move a member between rooms mid-lease with an automatic prorated adjustment.",
    steps: [
      { t: "Open Room Moves → New request", d: "Go to **Operations → Room Moves** and start a request (a member can also request from the portal).", menu: "Operations → Room Moves", shot: "moves.png" },
      { t: "Choose target room & date", d: "Pick the destination room/bed and the **effective date**.", menu: "Move request form" },
      { t: "Review the preview", d: "The system computes the money: prorated new rent + a move fee − credit for unused old rent = one net adjustment, plus any deposit delta. Billing catch-up runs first.", menu: "Preview delta" },
      { t: "Approve", d: "A **manager approves** the request before it takes effect. A request can be cancelled up to this point.", menu: "Approve" },
      { t: "Execute", d: "On execute: the old lease ends and a new one starts; **both rooms flip status** (old → cleaning, new → occupied); the deposit follows the member.", menu: "Execute" },
      { t: "One adjustment invoice", d: "A single invoice carries the exact prorated delta; the full move history is recorded on the member timeline. Link move-out/move-in inspections if needed.", menu: "Adjustment invoice" }
    ]
  },
  {
    id: "maintenance",
    title: "🔧 Handle a maintenance ticket",
    role: "Staff / Maintenance",
    time: "~varies",
    intro: "Track a repair from report to verified close, with SLA timers and costs.",
    steps: [
      { t: "A ticket is raised", d: "Members raise tickets from the portal/Telegram; staff can log them too. It records category, priority, room/building and who reported it.", menu: "Operations → Maintenance" },
      { t: "Acknowledge / assign", d: "Move **open → assigned** to a technician or vendor. The SLA clock is set by priority (urgent 4h … low 168h).", menu: "Ticket → Assign", shot: "maintenance.png" },
      { t: "Start work", d: "Set the ticket **in_progress** while the repair is done.", menu: "In progress" },
      { t: "Log parts & labour", d: "**Consume stock parts** (M15) — their cost flows onto the ticket automatically — and record labour cost.", menu: "Consume part / add cost" },
      { t: "Resolve", d: "Mark **resolved** once the work is finished.", menu: "Resolve" },
      { t: "Verify / close", d: "Move to **verified/closed**. Costs route to an **expense** (operator) or the **owner's P&L** (owner-borne → owner statement). A daily sweep flags any SLA breach.", menu: "Verify / close" }
    ]
  },
  {
    id: "pos",
    title: "🏪 Run a POS sale (counter / canteen)",
    role: "Staff / cashier",
    time: "~5 min per sale",
    intro: "Sell products over the counter and optionally charge them to a resident's room.",
    steps: [
      { t: "Open a POS session", d: "In **Store → POS**, open a register session with your opening **cash float**.", menu: "Store → POS → Open session", shot: "pos.png" },
      { t: "Add items to the sale", d: "Pick products from the catalog or scan a **barcode (EAN-13)** badge. Linked products decrement stock when sold.", menu: "New sale" },
      { t: "Take payment", d: "Choose **cash / QR / card**, or **charge to room**.", menu: "Payment method" },
      { t: "Charge to room (optional)", d: "Charging to a room auto-issues a **one-time invoice** to that member and posts to receivables — the resident pays it with their normal rent.", menu: "Charge to room" },
      { t: "Receipt", d: "A receipt PDF is auto-filed; thermal printing (58/80mm, auto-print, copies) is set in **Settings → Printers**.", menu: "Receipt" },
      { t: "Close the session", d: "At end of shift, **close**: expected cash = float + Σ cash sales. Enter the counted cash and the system records the **variance**.", menu: "Close session" }
    ]
  },
  {
    id: "telegram",
    title: "💬 Set up the Telegram bot & notifications",
    role: "Admin / Super Admin",
    time: "~15 min",
    intro: "Connect Telegram so members get receipts/reminders and staff get alerts in chat.",
    steps: [
      { t: "Set the bot token", d: "In **Settings → Providers/Secrets**, store the Telegram bot token. It is sealed (AES-256-GCM) and shown masked. Configure the bot name/welcome in **Settings → Telegram**.", menu: "Settings → Telegram / Secrets", shot: "telegram.png" },
      { t: "Allow member linking", d: "Enable **allowMemberLinking** in Settings → Telegram so residents can link their own accounts.", menu: "Settings → Telegram" },
      { t: "Give a user their link code", d: "Open **Comms → Telegram Bot** and choose **link** — a one-time code is shown (the bot never sees a password).", menu: "Comms → Telegram Bot" },
      { t: "Link in the chat", d: "In Telegram the user opens the bot and sends `/link <code>`. The bot binds their account (permission-checked) and confirms.", menu: "Bot → /link <code>" },
      { t: "Set notification toggles", d: "Switch on/off which events they get: invoice issued, payment confirmed, dunning, reminders, ticket/complaint updates, owner statements, low stock, occupancy digest.", menu: "Notification toggles" },
      { t: "Customise wording (optional)", d: "In **Settings → Templates**, override message text for the five member events using {placeholders}. In the demo system, messages are **mocked to the outbox** (shown on the Telegram screen).", menu: "Settings → Templates" }
    ]
  }
];

// ── Styles ──
const CSS = `
:root{
  --bg:#f6f8fb; --panel:#ffffff; --ink:#1e293b; --muted:#64748b; --line:#e6ebf2;
  --brand:#2563eb; --brand-d:#1d4ed8; --teal:#0d9488; --green:#16a34a; --amber:#d97706;
  --red:#dc2626; --soft:#eef4ff; --radius:14px;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans Khmer","PingFang SC","Microsoft YaHei",sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
a{color:var(--brand);text-decoration:none}
a:hover{text-decoration:underline}
img{max-width:100%}
#menuBtn{display:none;position:fixed;top:12px;left:12px;z-index:60;width:44px;height:44px;border-radius:10px;border:1px solid var(--line);background:#fff;font-size:20px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.08)}
#sidebar{position:fixed;top:0;left:0;bottom:0;width:288px;overflow-y:auto;background:var(--panel);border-right:1px solid var(--line);padding:18px 14px 40px;z-index:50}
.brand{display:flex;align-items:center;gap:11px;padding:6px 8px 16px;border-bottom:1px solid var(--line);margin-bottom:12px}
.brand:hover{text-decoration:none}
.brand-badge{width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,var(--brand),var(--teal));color:#fff;font-weight:800;display:grid;place-items:center;font-size:17px;letter-spacing:.5px}
.brand-name{font-weight:800;font-size:16px;color:var(--ink)}
.brand-sub{font-size:12px;color:var(--muted)}
.nav-group{margin:14px 0 4px}
.nav-group-title{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:700;padding:0 10px 6px}
.nav-link{display:block;padding:7px 10px;border-radius:9px;color:#334155;font-size:14px;margin:1px 0}
.nav-link:hover{background:var(--soft);text-decoration:none}
.nav-link.active{background:var(--brand);color:#fff;font-weight:600}
.nav-home,.nav-walk{font-weight:600;margin-bottom:2px}
.side-foot{margin-top:18px;padding:12px 10px;font-size:11.5px;color:var(--muted);border-top:1px solid var(--line)}
main{margin-left:288px;padding:34px 42px 90px;max-width:1080px}
.crumbs{font-size:13px;color:var(--muted);margin-bottom:6px}
.crumbs b{color:var(--brand-d)}
.content h1.part-title{font-size:30px;line-height:1.25;margin:6px 0 18px;padding-bottom:14px;border-bottom:3px solid var(--brand)}
.content h2{font-size:23px;margin:38px 0 14px;padding-top:10px;display:flex;align-items:baseline;gap:10px;scroll-margin-top:20px}
.content h2 .sec-no{flex:0 0 auto;width:28px;height:28px;border-radius:8px;background:var(--soft);color:var(--brand-d);font-size:14px;font-weight:800;display:inline-grid;place-items:center}
.content h3{font-size:18px;margin:26px 0 10px;color:#0f172a}
.content h4{font-size:15px;margin:18px 0 8px;color:#334155}
.content p{margin:12px 0}
.content ul,.content ol{margin:12px 0;padding-left:24px}
.content li{margin:5px 0}
.content hr.soft{border:0;border-top:1px solid var(--line);margin:26px 0}
code{background:#eef2f7;border:1px solid #e2e8f0;border-radius:6px;padding:1.5px 6px;font-size:.88em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#be185d}
pre.code{background:#0f172a;color:#e2e8f0;border-radius:12px;padding:16px 18px;overflow:auto;font-size:13px;line-height:1.55;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.table-wrap{overflow-x:auto;margin:16px 0;border:1px solid var(--line);border-radius:12px}
table{border-collapse:collapse;width:100%;font-size:14px;background:#fff}
th,td{padding:9px 13px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
th{background:#f1f5f9;font-weight:700;font-size:12.5px;text-transform:uppercase;letter-spacing:.02em;color:#475569;white-space:nowrap}
tr:last-child td{border-bottom:0}
tbody tr:hover{background:#f8fafc}
.note{background:#f0f9ff;border:1px solid #bae6fd;border-left:4px solid var(--brand);border-radius:10px;padding:11px 15px;margin:16px 0;color:#0c4a6e;font-size:14.5px}
.note-warn{background:#fffbeb;border-color:#fde68a;border-left-color:var(--amber);color:#78350f}
.note-danger{background:#fef2f2;border-color:#fecaca;border-left-color:var(--red);color:#7f1d1d}
.note strong{color:inherit}
/* diagrams */
figure.diagram{margin:20px 0;padding:0;background:linear-gradient(180deg,#fbfdff,#f4f8ff);border:1px solid var(--line);border-radius:16px;padding:18px}
figure.diagram figcaption{font-size:13px;font-weight:700;color:var(--brand-d);text-transform:uppercase;letter-spacing:.04em;margin-bottom:14px;display:flex;align-items:center;gap:8px}
figure.diagram figcaption:before{content:"▣";color:var(--teal)}
.flow{display:flex;flex-direction:column;align-items:stretch;gap:0}
.flow-h{flex-direction:row;align-items:stretch;flex-wrap:wrap;justify-content:center}
.flow-node{background:#fff;border:1.5px solid #cbd5e1;border-radius:11px;padding:9px 14px;font-size:13.5px;font-weight:600;color:#1e293b;text-align:center;box-shadow:0 1px 2px rgba(15,23,42,.05)}
.flow-node.v-blue{background:#eff6ff;border-color:#93c5fd;color:#1e40af}
.flow-node.v-green{background:#ecfdf5;border-color:#86efac;color:#166534}
.flow-node.v-amber{background:#fffbeb;border-color:#fcd34d;color:#92400e}
.flow-node.v-teal{background:#f0fdfa;border-color:#5eead4;color:#115e59}
.flow-arrow{text-align:center;color:#94a3b8;font-size:18px;line-height:1;margin:2px 0;font-weight:700}
.flow-arrow-h{margin:0 6px;align-self:center}
.formula{background:#fff;border:1.5px dashed #c7d2fe;border-radius:12px;padding:14px 18px}
.formula-title{font-weight:800;color:var(--brand-d);margin-bottom:10px;font-size:14.5px}
.formula-row{padding:5px 0;font-size:14.5px}
.formula-rule{border-top:2px solid var(--ink);margin:6px 0;width:100%}
/* home */
.hero{background:linear-gradient(135deg,#1e3a8a,#0d9488);border-radius:20px;padding:34px;color:#fff;display:grid;grid-template-columns:1.2fr 1fr;gap:24px;align-items:center;overflow:hidden}
.hero h1{font-size:34px;line-height:1.15;margin:0 0 12px}
.hero p{margin:0 0 18px;color:#dbeafe;font-size:15.5px}
.hero-img{border-radius:14px;background:#fff;padding:8px;box-shadow:0 12px 30px rgba(0,0,0,.25)}
.hero-img img{display:block;border-radius:9px;width:100%}
.btn{display:inline-block;background:#fff;color:var(--brand-d);font-weight:700;padding:11px 20px;border-radius:11px;margin:4px 8px 4px 0;border:none;cursor:pointer;font-size:14.5px}
.btn:hover{text-decoration:none;transform:translateY(-1px)}
.btn.ghost{background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.4)}
.home-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin-top:22px}
.home-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;transition:.15s;cursor:pointer}
.home-card:hover{border-color:var(--brand);box-shadow:0 6px 20px rgba(37,99,235,.12);transform:translateY(-2px)}
.home-card .ico{font-size:24px}
.home-card h3{margin:8px 0 4px;font-size:15.5px}
.home-card p{margin:0;color:var(--muted);font-size:13px}
.section-label{font-size:13px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:700;margin:30px 0 4px}
.feature-row{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:22px}
.feature-box{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;gap:16px;align-items:center}
.feature-box img{width:120px;flex:0 0 120px;border-radius:10px}
.feature-box h3{margin:0 0 6px;font-size:16px}
.feature-box p{margin:0;font-size:13.5px;color:var(--muted)}
/* walks */
.walk-layout{display:grid;grid-template-columns:270px 1fr;gap:24px;align-items:start}
.walk-list{position:sticky;top:20px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px}
.walk-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:0;padding:10px 11px;border-radius:10px;cursor:pointer;font-size:13.5px;color:#334155;font-weight:600}
.walk-item:hover{background:var(--soft)}
.walk-item.active{background:var(--brand);color:#fff}
.walk-num{flex:0 0 24px;width:24px;height:24px;border-radius:50%;background:var(--soft);color:var(--brand-d);display:grid;place-items:center;font-size:12.5px;font-weight:800}
.walk-item.active .walk-num{background:rgba(255,255,255,.25);color:#fff}
.walk-panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:26px}
.walk-meta{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 4px}
.chip{font-size:12px;font-weight:700;padding:4px 11px;border-radius:999px;background:var(--soft);color:var(--brand-d)}
.chip.time{background:#f0fdfa;color:var(--teal)}
.walk-intro{color:var(--muted);font-size:14.5px;margin:8px 0 22px}
.steps{counter-reset:s;list-style:none;padding:0;margin:0}
.step{display:flex;gap:16px;padding:16px 0;border-bottom:1px dashed var(--line);opacity:.45;transition:.2s}
.step.done{opacity:.55}
.step.current{opacity:1}
.step.todo{opacity:.45}
.step-badge{flex:0 0 38px;width:38px;height:38px;border-radius:50%;border:2px solid #cbd5e1;display:grid;place-items:center;font-weight:800;color:#94a3b8;background:#fff}
.step.current .step-badge{background:var(--brand);border-color:var(--brand);color:#fff;box-shadow:0 0 0 5px #dbeafe}
.step.done .step-badge{background:var(--green);border-color:var(--green);color:#fff}
.step-body h4{margin:2px 0 6px;font-size:16px}
.step-body p{margin:0;font-size:14.5px}
.step-menu{display:inline-block;margin-top:8px;font-size:12px;background:#f8fafc;border:1px solid var(--line);border-radius:7px;padding:3px 9px;color:#475569}
.step-menu:before{content:"🧭 ";}
.shot-wrap{position:relative;margin-top:10px;border:1px solid var(--line);border-radius:11px;overflow:hidden;background:#eef2f7;box-shadow:0 2px 10px rgba(15,23,42,.08)}
.shot{display:block;width:100%;max-height:360px;object-fit:cover;object-position:top center}
.shot-cap{position:absolute;top:8px;left:8px;background:rgba(15,23,42,.72);color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px}
.step.todo .shot-wrap{display:none}
.walk-controls{display:flex;justify-content:space-between;margin-top:22px;gap:10px}
.wbtn{border:1px solid var(--line);background:#fff;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer;color:#334155;font-size:14px}
.wbtn.primary{background:var(--brand);color:#fff;border-color:var(--brand)}
.wbtn:disabled{opacity:.4;cursor:not-allowed}
.progress{height:8px;background:#eef2f7;border-radius:99px;overflow:hidden;margin:6px 0 20px}
.progress > div{height:100%;background:linear-gradient(90deg,var(--brand),var(--teal));width:0;transition:.3s}
.walk-done{background:#ecfdf5;border:1px solid #86efac;color:#166534;border-radius:12px;padding:14px 18px;font-weight:600;margin-top:18px;display:none}
.walk-done.show{display:block}
.subtoc{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin:0 0 22px;font-size:13.5px}
.subtoc b{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.subtoc a{display:inline-block;margin:4px 12px 4px 0;color:var(--brand-d)}
@media(max-width:900px){
  #sidebar{transform:translateX(-100%);transition:.2s;box-shadow:0 0 40px rgba(0,0,0,.2)}
  #sidebar.open{transform:translateX(0)}
  main{margin-left:0;padding:64px 18px 70px}
  #menuBtn{display:block}
  .hero{grid-template-columns:1fr}
  .feature-row,.walk-layout{grid-template-columns:1fr}
  .walk-list{position:static}
}
@media print{
  #sidebar,#menuBtn{display:none}
  main{margin:0;max-width:100%;padding:0}
  .home-card,.walk-list,.walk-controls,.progress{display:none}
  figure.diagram,.note,.table-wrap{break-inside:avoid}
}
`;

// ── Client app ──
const APP_JS = `
const $ = (s,r=document)=>r.querySelector(s);
const main = $('#main');

function route(){
  const hash = location.hash || '#/home';
  const h = hash.replace(/^#\\//,'');
  document.querySelectorAll('.nav-link').forEach(a=>{
    a.classList.toggle('active', a.dataset.route && h.startsWith(a.dataset.route));
  });
  $('#sidebar').classList.remove('open');
  if(h==='home') return renderHome();
  if(h==='walks'||h.startsWith('walk/')) return renderWalks(h);
  if(h.startsWith('part/')){
    const slug = h.split('/')[1];
    const sec = (h.split('#')[1])||null;
    return renderPart(slug, sec);
  }
  renderHome();
}

function renderHome(){
  const groups=[...new Set(PARTS.map(p=>p.group))];
  let cards='';
  for(const g of groups){
    cards += '<div class="section-label">'+g+'</div><div class="home-grid">';
    for(const p of PARTS.filter(x=>x.group===g)){
      cards += '<a class="home-card" href="#/part/'+p.slug+'"><div class="ico">📘</div><h3>'+p.label+'</h3><p>'+p.toc.length+' sections</p></a>';
    }
    cards += '</div>';
  }
  main.innerHTML =
   '<div class="hero"><div><h1>RentManager Guide</h1>'+
   '<p>A plain-language manual for staff, managers, finance and administrators — with diagrams and step-by-step walkthroughs. Verified against the actual application, so every button described really exists.</p>'+
   '<a class="btn" href="#/walks">🧭 Start a step-by-step workflow</a>'+
   '<a class="btn ghost" href="#/part/02-quick-start">⚡ Quick start</a></div>'+
   '<div class="hero-img"><img src="'+IMG.hero+'" alt="RentManager illustration"/></div></div>'+
   '<div class="feature-row">'+
   '<div class="feature-box"><img src="'+IMG.tenant+'" alt="Tenant"/><div><h3>For staff &amp; tenants</h3><p>Onboard members, create leases, bill monthly rent, collect payments and receipts, and help tenants pay by QR or the portal.</p><a href="#/part/03-user-guide">Open the User Guide →</a></div></div>'+
   '<div class="feature-box"><img src="'+IMG.admin+'" alt="Admin"/><div><h3>For administrators</h3><p>Set up users &amp; roles, permissions, business settings, 2FA security, Telegram, reports and backups.</p><a href="#/part/08-administrator-guide">Open the Admin Guide →</a></div></div>'+
   '</div>'+ cards;
  window.scrollTo(0,0);
}

function renderPart(slug, sec){
  const p = PARTS.find(x=>x.slug===slug);
  if(!p){ main.innerHTML='<p>Part not found.</p>'; return; }
  const toc = p.toc.map(t=>'<a href="#/part/'+p.slug+'#sec-'+p.slug+'-'+t.slug+'">'+t.n+'. '+t.text+'</a>').join('');
  main.innerHTML =
    '<div class="crumbs">Guide · <b>'+p.group+'</b> · '+p.label+'</div>'+
    '<div class="content">'+p.html+'</div>';
  if(p.toc.length){
    const bar=document.createElement('div');
    bar.className='subtoc';
    bar.innerHTML='<b>On this page</b><br>'+toc;
    $('.content',main).insertBefore(bar, $('.content',main).firstChild);
  }
  window.scrollTo(0,0);
  if(sec){
    const el=document.getElementById(sec);
    if(el) setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),60);
  }
}

function renderWalks(h){
  const id = h.startsWith('walk/') ? h.split('/')[1] : WALKS[0].id;
  const w = WALKS.find(x=>x.id===id) || WALKS[0];
  const idx = WALKS.findIndex(x=>x.id===w.id);
  main.innerHTML =
    '<div class="crumbs">Guide · <b>Step-by-step Workflows</b></div>'+
    '<h1 style="margin:6px 0 18px;font-size:28px">🧭 Step-by-step Workflows</h1>'+
    '<div class="walk-layout"><div class="walk-list">'+WALK_NAV+'</div>'+
    '<div class="walk-panel" id="walkPanel"></div></div>';
  drawWalk(idx,0);
  document.querySelectorAll('.walk-item').forEach(b=>b.addEventListener('click',()=>{
    drawWalk(WALKS.findIndex(x=>x.id===b.dataset.walk),0);
  }));
  window.scrollTo(0,0);
}

function drawWalk(idx, step){
  const w = WALKS[idx];
  document.querySelectorAll('.walk-item').forEach((b,i)=>b.classList.toggle('active', i===idx));
  const total = w.steps.length;
  const pct = Math.round((step/total)*100);
  let stepsHtml = w.steps.map((s,i)=>{
    const cls = i<step ? 'done' : i===step ? 'current' : 'todo';
    const badge = i<step ? '✓' : (i+1);
    return '<li class="step '+cls+'"><div class="step-badge">'+badge+'</div><div class="step-body">'+
      '<h4>'+s.t+'</h4><p>'+md(s.d)+'</p>'+
      (s.shot?'<div class="shot-wrap"><img class="shot" loading="lazy" src="img/'+s.shot+'" alt="'+s.t+'" /><span class="shot-cap">🖼️ Illustrated screen preview</span></div>':'')+
      (s.menu?'<span class="step-menu">'+s.menu+'</span>':'')+'</div></li>';
  }).join('');
  const panel=$('#walkPanel');
  panel.innerHTML =
    '<h2 style="margin:0;font-size:22px">'+w.title+'</h2>'+
    '<div class="walk-meta"><span class="chip">👤 '+w.role+'</span><span class="chip time">⏱ '+w.time+'</span></div>'+
    '<p class="walk-intro">'+w.intro+'</p>'+
    '<div class="progress"><div style="width:'+pct+'%"></div></div>'+
    '<ol class="steps">'+stepsHtml+'</ol>'+
    '<div class="walk-done'+(step>=total?' show':'')+'">✅ Workflow complete — you can do this unaided. Pick the next workflow from the list.</div>'+
    '<div class="walk-controls">'+
      '<div><button class="wbtn" id="prevBtn" '+(step<=0?'disabled':'')+'>← Back</button> '+
      '<button class="wbtn" id="restartBtn">↺ Restart</button></div>'+
      '<button class="wbtn primary" id="nextBtn" '+(step>=total?'disabled':'')+'>'+(step>=total-1?'Finish ✓':'Next step →')+'</button>'+
    '</div>';
  $('#prevBtn').onclick=()=>drawWalk(idx,Math.max(0,step-1));
  $('#nextBtn').onclick=()=>drawWalk(idx,Math.min(total,step+1));
  $('#restartBtn').onclick=()=>drawWalk(idx,0);
}

// minimal inline markdown for walkthrough descriptions (**bold**)
function md(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/\\*\\*([^*]+)\\*\\*/g,'<strong>$1</strong>')
    .replace(/\\x60([^\\x60]+)\\x60/g,'<code>$1</code>');
}

window.addEventListener('hashchange', route);
$('#menuBtn').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
route();
`;

// ── Assemble the page ──
const navGroups = ["Start", "Using RentManager", "Finance & Insights", "Administration", "Reference"];
let sidebar = "";
for (const g of navGroups) {
  sidebar += `<div class="nav-group"><div class="nav-group-title">${g}</div>`;
  for (const p of parts.filter((x) => x.group === g)) {
    sidebar += `<a class="nav-link" data-route="part/${p.slug}" href="#/part/${p.slug}">${p.label}</a>`;
  }
  sidebar += `</div>`;
}

const partsJSON = JSON.stringify(
  parts.map((p) => ({ slug: p.slug, label: p.label, group: p.group, html: p.html, toc: p.toc }))
);
const walkJSON = JSON.stringify(walkthroughs);
const walkNav = walkthroughs
  .map(
    (w, i) =>
      `<button class="walk-item" data-walk="${w.id}"><span class="walk-num">${i + 1}</span><span>${w.title}</span></button>`
  )
  .join("");

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>RentManager — User &amp; Administrator Guide</title>
<style>${CSS}</style>
</head>
<body>
<button id="menuBtn" aria-label="Menu">☰</button>
<aside id="sidebar">
  <a class="brand" href="#/home">
    <div class="brand-badge">RM</div>
    <div><div class="brand-name">RentManager</div><div class="brand-sub">User &amp; Admin Guide</div></div>
  </a>
  <nav>
    <a class="nav-link nav-home" data-route="home" href="#/home">🏠 Home</a>
    <a class="nav-link nav-walk" data-route="walks" href="#/walks">🧭 Step-by-step Workflows</a>
    ${sidebar}
  </nav>
  <div class="side-foot">Verified against the application source · ${parts.length} parts</div>
</aside>
<main id="main"></main>

<script>
const PARTS = ${partsJSON};
const WALKS = ${walkJSON};
const IMG = { hero: "${img.hero}", tenant: "${img.tenant}", admin: "${img.admin}" };
const WALK_NAV = ${JSON.stringify(walkNav)};
${APP_JS}
</script>
</body>
</html>`;

fs.writeFileSync(path.join(here, "index.html"), html);

// Also publish into the Next.js public/ folder so the guide is served in-app
// at /guide (see src/app/guide/page.tsx) and opens from the sidebar.
const publicGuide = path.resolve(here, "../../../public/guide");
fs.rmSync(publicGuide, { recursive: true, force: true });
fs.mkdirSync(publicGuide, { recursive: true });
fs.writeFileSync(path.join(publicGuide, "index.html"), html);
fs.cpSync(path.join(here, "img"), path.join(publicGuide, "img"), { recursive: true });

console.log("Built docs/manual/site/index.html —", parts.length, "parts,", walkthroughs.length, "walkthroughs");
console.log("Published to public/guide/ (in-app at /guide)");
