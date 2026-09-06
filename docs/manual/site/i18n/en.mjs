// Guide site i18n — English (source of truth).
// Walkthroughs, diagrams and UI chrome for the guide's three languages
// (English / ខ្មែរ / 中文). English is the master: km/zh mirror it 1:1
// (same walk ids, same step counts, same diagram keys).
// Menu paths use the app's own translated labels (src/lib/i18n.ts).

export const meta = {
  code: "en",
  native: "English",
  htmlLang: "en"
};

export const GROUP_NAMES = ["Start", "Using RentManager", "Finance & Insights", "Administration", "Reference"];

export const PART_LABELS = {
  "01-system-overview": "System Overview",
  "02-quick-start": "Quick Start",
  "03-user-guide": "User Guide",
  "04-business-workflows": "Business Workflows",
  "05-financial-accounting-guide": "Financial & Accounting",
  "06-reports-guide": "Reports",
  "07-telegram-notifications": "Telegram & Notifications",
  "08-administrator-guide": "Administrator Guide",
  "09-security-guide": "Security Guide",
  "10-troubleshooting": "Troubleshooting",
  "11-faq": "FAQ",
  "12-glossary": "Glossary",
  "13-golden-paths": "Golden Paths & Scenarios"
};

export const UI = {
  title: "RentManager — User & Administrator Guide",
  brandSub: "User & Admin Guide",
  side: {
    home: "🏠 Home",
    walks: "🧭 Step-by-step Workflows",
    lang: "Language",
    foot: "Verified against the application source · {n} parts"
  },
  home: {
    heroTitle: "RentManager Guide",
    heroSub:
      "A plain-language manual for staff, managers, finance and administrators — with diagrams and step-by-step walkthroughs. Verified against the actual application, so every button described really exists.",
    btnWalks: "🧭 Start a step-by-step workflow",
    btnQuick: "⚡ Quick start",
    featStaffTitle: "For staff & tenants",
    featStaffText:
      "Onboard members, create leases, bill monthly rent, collect payments and receipts, and help tenants pay by QR or the portal.",
    featStaffLink: "Open the User Guide →",
    featAdminTitle: "For administrators",
    featAdminText:
      "Set up users & roles, permissions, business settings, 2FA security, Telegram, reports and backups.",
    featAdminLink: "Open the Admin Guide →",
    sections: "{n} sections"
  },
  part: {
    notFound: "Part not found.",
    onThisPage: "On this page",
    crumb: "Guide"
  },
  walks: {
    crumb: "Step-by-step Workflows",
    title: "🧭 Step-by-step Workflows",
    prev: "← Back",
    restart: "↺ Restart",
    next: "Next step →",
    finish: "Finish ✓",
    done: "✅ Workflow complete — you can do this unaided. Pick the next workflow from the list.",
    shotCap: "🖼️ Illustrated screen preview"
  }
};

export const WALKS = [
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
    title: "🧑‍ Onboard a member (tenant)",
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

// Diagrams — keyed by part slug → English h2 slug.
// { cap, nodes: [["variant"?, "text"]…] } or { cap, formula: { title, rows } }.
export const DIAGRAMS = {
  "01-system-overview": {
    "14-how-the-system-works-the-end-to-end-lifecycle": {
      cap: "End-to-end lifecycle — how information moves",
      nodes: [
        ["v-blue", "Sign in → Dashboard"],
        ["Property → Building → Floor → Room (price & status)"],
        ["Owner + Owner contract"],
        ["v-green", "Member profile + KYC (prospect → verified)"],
        ["v-green", "Lease activated — room occupied, deposit billed, services on"],
        ["Monthly billing job → Invoice (rent + services + utilities)"],
        ["v-amber", "Member pays (QR / cash / bank / card) → Receipt"],
        ["Ledger posts balanced entries (append-only)"],
        ["Expenses · POS sales · stock movements"],
        ["v-teal", "Profit & Loss → Owner statement → paid"],
        ["Reports · dashboard KPIs · Telegram"]
      ]
    },
    "15-key-relationships-between-modules": {
      cap: "The hierarchy everything hangs off",
      nodes: [
        ["Property"],
        ["Building (owned by one Owner)"],
        ["Floor"],
        ["Room"],
        ["Beds · Meters · Leases · Tickets"],
        ["v-teal", "Lease → Invoices → Payments → Ledger"]
      ]
    }
  },
  "03-user-guide": {
    "1-authentication-login": {
      cap: "Signing in",
      nodes: [
        ["Open login · pick language (English / ខ្មែរ / 中文)"],
        ["Email + password"],
        ["2FA code? (required for Admin+)"],
        ["v-amber", "First login? Set a new password"],
        ["v-green", "Dashboard 🎉"]
      ]
    },
    "3-properties-rooms-m04": {
      cap: "Room status machine",
      horiz: true,
      nodes: [
        ["v-green", "vacant"],
        ["reserved (draft lease)"],
        ["v-blue", "occupied (lease active)"],
        ["cleaning (after move-out)"],
        ["maintenance (reason required)"],
        ["v-green", "back to vacant"]
      ]
    },
    "4-members-m02-documents-m17": {
      cap: "Member lifecycle",
      horiz: true,
      nodes: [
        ["v-amber", "prospect"],
        ["KYC complete → verified"],
        ["lease active → active"],
        ["notice given"],
        ["v-blue", "moved_out"]
      ]
    },
    "6-leases-contracts-m05": {
      cap: "Lease lifecycle & its effects",
      nodes: [
        ["v-amber", "draft — reserves the room"],
        ["v-green", "activate — room = occupied · member = active · deposit billed · first invoice scheduled"],
        ["notice (move-out)"],
        ["v-blue", "terminate / complete — room = cleaning · member = moved_out · deposit settlement"]
      ]
    },
    "10-invoices-monthly-billing-m07": {
      cap: "An invoice's life",
      horiz: true,
      nodes: [
        ["v-amber", "draft"],
        ["issued (immutable · gapless number · PDF filed)"],
        ["partial_paid"],
        ["v-green", "paid"],
        ["overdue (after grace) / void (Super Admin + reason)"]
      ]
    },
    "11-payments-receipts-m09": {
      cap: "Payment lifecycle",
      nodes: [
        ["v-amber", "pending"],
        ["confirmed → allocated oldest-first → receipt RCP-… → ledger posts"],
        ["v-blue", "refunded (Accountant+)"],
        ["failed (no receipt / no ledger impact)"]
      ]
    },
    "13-deposits-m10": {
      cap: "Deposit lifecycle (money held, not income)",
      nodes: [
        ["billed (installment invoices at activation)"],
        ["held in 2100 Deposit Liability"],
        ["v-teal", "settled: deductions (evidence) + refund (Accountant approval)"],
        ["liability nets to 0 for the closed lease"]
      ]
    },
    "18-pos-m14": {
      cap: "POS register session",
      nodes: [
        ["Open session (opening float)"],
        ["Sell — cash / QR / card / charge to room"],
        ["Stock decrements · receipt PDF filed"],
        ["v-amber", "Close session — count cash → variance recorded"]
      ]
    }
  },
  "04-business-workflows": {
    "41-the-tenant-lifecycle-move-in-move-out": {
      cap: "The full resident journey",
      nodes: [
        ["Prospect → Member (M02)"],
        ["KYC uploads complete → verified (M17)"],
        ["Lease draft → ACTIVE (room occupied, deposit billed) (M05/M10)"],
        ["Monthly living: invoices · payments · meters · tickets · moves"],
        ["Notice given · dues cleared to 0"],
        ["Move-out inspection completed (hard gate) (M18)"],
        ["v-teal", "Lease terminated — room cleaning · deposit settled (M10)"],
        ["Room → vacant, ready to re-let"]
      ]
    },
    "42-billing-workflow-monthly-close-rhythm": {
      cap: "Monthly close rhythm",
      nodes: [
        ["1 · Enter meter readings (M11)"],
        ["2 · Log per-use services (M12) · 3 · POS room charges (M14)"],
        ["v-green", "4 · RUN invoice generation (idempotent, gapless) (M06/M07)"],
        ["5 · Spot-check totals"],
        ["6 · Issue invoices → portal + Telegram"],
        ["Daily job: late fees → overdue → dunning +3/+7/+14"],
        ["v-amber", "Collect → receipts → ledger"]
      ]
    },
    "43-payment-workflow": {
      cap: "From payment to books",
      nodes: [
        ["Member pays (QR in portal / cash / bank / card / cheque)"],
        ["Cash/bank = confirmed · QR/card = pending → webhook (once)"],
        ["Allocated oldest-first; deposit first; overpay → member credit"],
        ["v-teal", "Invoice partial_paid/paid · receipt filed · ledger posts · Telegram receipt"]
      ]
    },
    "48-owner-statement-workflow": {
      cap: "Owner statement → payout",
      nodes: [
        ["Generate (idempotent per contract+month) — Accountant+"],
        ["collected × share% (or fixed rent) − fees − costs ± adjustments"],
        ["v-amber", "draft → approved (DR 3900 · CR 2200)"],
        ["v-green", "paid (DR 2200 · CR cash/bank) · PDF filed → owner portal"]
      ]
    }
  },
  "05-financial-accounting-guide": {
    "55-profit-loss-pl": {
      cap: "Profit & Loss in one picture",
      formula: {
        title: "Net profit = Revenue − Expenses − Owner payout",
        rows: [
          "**Revenue** — rent (4000) + services (4100) + utilities (4200) + late fees (4300) + other/POS (4900)",
          "**− Expenses** — operating (5000) + bank fees (5100)",
          "**− Owner payout** — per the owner contract",
          "= **Net profit / loss** for the period"
        ]
      }
    },
    "57-owner-statements-m24-owner-payouts": {
      cap: "What an owner is paid",
      formula: {
        title: "Net owner payout",
        rows: [
          "Money **collected** for the owner's units",
          "× owner **share %** (or fixed monthly master rent)",
          "− **management fee** − pass-through expenses − owner-borne maintenance",
          "± **approved adjustments** (audited)",
          "= **Net owner payout**"
        ]
      }
    }
  },
  "08-administrator-guide": {
    "87-admin-golden-path-initial-setup-order": {
      cap: "Setup order for a new system",
      nodes: [
        ["1 · Company / locale (currency, timezone, language)"],
        ["2 · Properties → buildings → floors → rooms"],
        ["3 · Roles · 4 · Users (assign roles + properties)"],
        ["5 · Rent engine · 6 · Opening balances"],
        ["7 · Payment methods & provider secrets"],
        ["8 · Billing / dunning / rent alerts"],
        ["9 · Owners + contracts + payout methods"],
        ["10 · Notifications + Telegram bot"],
        ["11 · Security (2FA, sessions, backups)"],
        ["12 · Feature flags + reports"],
        ["v-green", "13 · Test golden path · 14 · Review audit log · backup"]
      ]
    }
  }
};
