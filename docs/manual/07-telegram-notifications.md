# Part 7 — Telegram & Notifications Guide

RentManager reaches people outside the app through **Telegram** (a chat bot) plus
**in-app** indicators (dashboard alerts, badges). This part explains what
messages exist, when they fire, and how to connect.

> 🚫 **Not confirmed in the current system:** **email** notifications and
> **SMS**. The design documents mention email delivery, but the current build
> has **no email sending channel** (no mail library/integration in code) and no
> SMS. Automated messages go via **Telegram**; reminders also appear **in-app**
> (dashboard **Rent dues**, expiry badges). The notification **template** settings
> are Telegram templates.

---

## 7.1 Telegram bot (M21) — what it does

- Sends **event notifications** to linked users (members, staff, owners).
- Answers a few **commands** in chat (members see their **own** data only).
- Can return a **payment QR** so a member can pay from chat.

### Notifications that exist (event → template)
| Event | Recipient | When it fires |
|---|---|---|
| `invoice.issued` | Member | An invoice is issued |
| `payment.confirmed` | Member | A payment is confirmed (a receipt message) |
| `invoice.dunning_reminder` | Member | Scheduled dunning stage (+3/+7/+14) |
| `rent.reminder` | Member | Rent due soon (from the rent-alerts job) |
| `rent.overdue` | Member | Rent is overdue |
| `ticket.transitioned` | Member | A maintenance ticket changes status |
| `complaint.transitioned` | Member | A complaint changes status |
| `statement.approved` | Owner | An owner statement is approved/ready |
| `stock.low` | Staff/admin | An item drops below its low-stock threshold |
| *(occupancy digest)* | Staff chats | A daily occupancy digest (per the dispatch job) |

Each user has **per-user toggle preferences** (switch each notification type on/off).

### Bot commands
| Command | Who | What it returns |
|---|---|---|
| `/start` | anyone | Welcome/help text (configurable) |
| `/link <code>` | user | Binds the Telegram account to a RentManager user (one-time code) |
| `/status` | member | Current lease/room status (own data) |
| `/dues` | member | Outstanding balance (own data only) |
| `/pay` | member | A payment QR for what's owed (via M13) |
| `/help` | anyone | Command list |

Security: the bot uses a **signed webhook** (spoofed updates are rejected);
member commands are RBDC-checked and only ever return **that member's** data.

---

## 7.2 Connecting your Telegram (linking)

The link uses a **one-time code** (the bot never sees your password).

### From the admin/owner side
1. Open **Comms → Telegram Bot** (or **My Account**).
2. Choose to **link** your account — the system shows a one-time **link code**.
3. In Telegram, open the bot and send `/link <code>`.
4. The bot binds your `telegram_id` (permission-checked) and confirms.
5. Set your **notification toggles** (which messages you want).

### From the tenant portal (members)
1. Members open the bot and send `/link <code>` using the code shown in their portal.
   - Member self-linking can be switched on/off by the org via
     **Settings → Telegram → allowMemberLinking**.
2. Once linked they receive receipts/reminders and can use `/status`, `/dues`, `/pay`.

### Unlink
Use **unlink** in the Telegram screen (or `/link` with a new account). Unlinking
stops messages for that chat.

> There is also an **admin-link** flow (`/api/telegram/admin-link`) for staff
> setup, and a **link-state** check used by the UI.

---

## 7.3 Sending documents / information via Telegram

- **Generated documents are delivered as Telegram messages** where a document is
  attached to an event — most notably the **payment receipt** on
  `payment.confirmed` and the **owner statement** when it is approved
  (`statement.approved`). Invoice PDFs are filed in the document registry and
  members can also view them in the portal.
- The bot **token** is stored as a **sealed secret** (AES-256-GCM, masked in the
  UI); rotate it in **Settings → Providers/Secrets**.
- In the development/demo system the bot sender is **mocked** — messages are
  recorded in an **outbox** (visible on the Telegram admin screen: status/body)
  rather than sent to real Telegram. Production wiring uses the live bot via the
  signed webhook.

> On the Telegram admin screen you can review linked chats (Principal / Linked),
> toggle notifications off per event, and see the **outbox** (message status and
> body) — useful to confirm what *would* be sent.

---

## 7.4 In-app notifications (no setup needed)

Even without Telegram, the system surfaces reminders inside the app:

| Where | What |
|---|---|
| **Dashboard → Rent dues (M33)** | Invoices due within the "ahead days" window and overdue invoices |
| **Member dues badge** | "$265.00 due" style badges on members/invoices |
| **Document expiry badges** | KYC/document expiring (30/7-day reminders) |
| **Reports → Overdue & not paid** | The work-list of overdue rent |
| **Low stock** | Items below threshold (also a Telegram `stock.low` event) |
| **SLA / breach indicators** | Overdue tickets/complaints (maintenance/complaint KPIs) |

---

## 7.5 Background jobs that produce notifications

These cron-shaped jobs (visible/triggerable per permissions) turn state into
messages:

| Job | Does | Permission |
|---|---|---|
| **billing-daily** | Late fees after grace; mark overdue; dunning reminders | M06:update |
| **rent-alerts** | Emits due-soon / overdue rent events (M33) | M33:update (Admin/PM) |
| **telegram-dispatch** | Drains events → Telegram messages; daily occupancy digest | M21:update (Admin+) |
| **sla-sweep** | Flags SLA breaches on tickets & complaints (escalations) | M19:update (staff+) |
| **attendance-sweep** | Flags missed clock-outs | M23:update |
| **invoice-generation** | Generates the period's invoices | M07:create |
| **statement-generation** | Generates owner statements | GLOBAL M24:update |

### Customising message wording
**Settings → Templates** lets an admin override the Telegram template for five
events: `invoice.issued`, `payment.confirmed`, `invoice.dunning_reminder`,
`rent.reminder`, `rent.overdue`. Templates support placeholders like `{total}`,
`{due}`, `{receipt}`, `{code}`. Events without an override use the built-in default.

---

## 7.6 Common Telegram issues
| Problem | Check / fix |
|---|---|
| No messages arriving | (1) Linked? (2) Toggles on? (3) In dev, messages are **mocked to the outbox** — check the Telegram screen; (4) daily jobs dispatch on schedule/trigger |
| Code rejected | Codes are one-time and short-lived — request a fresh code |
| Member sees someone else's data | This can't happen — commands are RBDC-checked to OWN scope; if you suspect an issue, report to an admin and check the audit log |
| Spoofed/odd messages | Webhook signature is verified; forged updates are rejected |
| Bot token leak risk | Rotate the sealed token in Settings; it is never shown in plain text after saving |
