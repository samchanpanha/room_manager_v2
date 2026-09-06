/// Module guide — one-line "what it does" + pro tips per module, shown in the
/// in-app Help dialog. The Driver.js tour (.? B in the chrome) walks the menu
/// and explains these modules; devs can grow tours per module later.

export interface ModuleGuideEntry {
  key: string;
  name: string;
  purpose: string;
  tips: string[];
}

export const MODULE_GUIDE: ModuleGuideEntry[] = [
  { key: "M01", name: "Users & RBDC", purpose: "Accounts, roles and the permission matrix that gates every page and API call.", tips: ["Root-level roles can't be deleted (protected).", "Matrix cells use letters — F/M/R/W/O — never edit permissions directly."] },
  { key: "M02", name: "Members", purpose: "Tenant/resident profiles with stay, contact and billing details.", tips: ["Members are property-scoped — staff only see their own buildings."] },
  { key: "M03", name: "Owners", purpose: "Landlords and building ownership, plus their bank pay-out details.", tips: ["Owners only ever see their own statements (OWN scope)."] },
  { key: "M04", name: "Properties & Rooms", purpose: "The building/room tree that everything else hangs off.", tips: ["Rooms carry status and move history; archiving soft-deletes."] },
  { key: "M06", name: "Rent Engine", purpose: "Monthly rent run that bills amounts per lease.", tips: ["Preview the run before posting — posting is written to the audit trail."] },
  { key: "M07", name: "Invoices", purpose: "Per-member invoices for rent, utilities and extras.", tips: ["Invoices are property-scoped; members/owners see their own."] },
  { key: "M08", name: "Ledger", purpose: "Double-entry accounts: every money event posts balanced lines.", tips: ["Only Admin/Accountant open the ledger; corrections are reversing entries."] },
  { key: "M09", name: "Payments", purpose: "Record received payments against invoices.", tips: ["Cash, QR, card and room-charge methods; each creates a ledger posting."] },
  { key: "M10", name: "Deposits", purpose: "Member security deposits — receipt, hold and refund.", tips: ["Refunds need the stored payout method"] },
  { key: "M11", name: "Utilities", purpose: "Meter reads and utility invoices.", tips: ["Meters are property-scoped — you only edit what you can see."] },
  { key: "M12", name: "Services", purpose: "Service catalog linked to building/room pricing.", tips: ["Used as invoice line items; keep names short."] },
  { key: "M14", name: "POS", purpose: "Front-desk register: scan, sell, print receipts and barcode labels.", tips: ["Badge scan adds items by EAN-13.", "Receipt copy/auto-print live in Settings → Printers."] },
  { key: "M15", name: "Stock", purpose: "On-hand inventory that only changes via approved movements.", tips: ["Never edit quantities directly — purchases, sales, consumption, transfers, stocktakes."] },
  { key: "M16", name: "Room Moves", purpose: "Move a member between rooms and re-price mid-lease.", tips: ["Creates prorated invoices for the moved period."] },
  { key: "M18", name: "Inspections", purpose: "Condition checklists per room with pass/fail outcomes.", tips: ["Scheduled repeats are common; results post to the room history."] },
  { key: "M19", name: "Maintenance", purpose: "Tickets for repairs — assign, log parts/cost, close.", tips: ["Consuming stock parts flows cost onto the ticket automatically."] },
  { key: "M20", name: "Expenses & P&L", purpose: "Operational expenses and profit/loss snapshots.", tips: ["Post expenses against categories; numbers flow to owner statements."] },
  { key: "M21", name: "Telegram", purpose: "Member notifications and the tenant chat bot.", tips: ["Bot token is a sealed secret — mask & rotate in Settings."] },
  { key: "M22", name: "Complaints", purpose: "Member-raised issues with status workflow.", tips: ["Owners can raise/comment on their own tickets."] },
  { key: "M23", name: "Attendance", purpose: "Staff clock-in/out with shift rules and geofence.", tips: ["Staff only punch themselves (O scope)."] },
  { key: "M24", name: "Owner Statements", purpose: "Period statements per owner building.", tips: ["Regenerating never rewrites history — new periods are added forward-only."] },
  { key: "M26", name: "Reports", purpose: "Aggregate dashboards and exportable views.", tips: ["Run the export if you want a file to send."] },
  { key: "M27", name: "Security", purpose: "2FA (TOTP), session and audit hardening.", tips: ["Admin+ must enroll a second factor before using other modules."] },
  { key: "M28", name: "Settings", purpose: "Org profile, branding, locale, printers, flags and secrets.", tips: ["Every change is audited, forward-only.", "Read-only for PM/Accountant."] },
  { key: "M29", name: "Purchase Orders", purpose: "Plan stock purchases and receive them as stock movements.", tips: ["Placement is bookkeeping; only Receiving changes on-hand stock.", "Partial receipts leave the PO placed until everything arrives."] },
  { key: "M32", name: "Short Stays", purpose: "Hourly / overnight / day-use rentals with duration-bucket pricing and a booking lifecycle (request → confirm → check-in → check-out).", tips: ["Price = first bucket covering the stay duration; Progressive plateaus at the top bucket, Blended bills whole days + remainder.", "POS room charges stream onto the booking's settlement invoice when the stay is in 'tab' mode — settle them all at check-out.", "Walk-in guests are auto-matched to a member profile by phone; repeats keep history.", "New bookings walk through a 3-step wizard with a live price quote — use the ? Tour button on this page."] }
];

/// Driver.js usage note shown in the Help dialog — tells staff how tours work
/// and tells developers how to add more steps.
export const DRIVERJS_NOTE = `How it works: the ? button plays a scripted highlight walk-through ("tour") over the screen. It runs entirely in your browser. Developers add steps by putting data-tour attributes on elements and registering the step list — see src/components/tour.tsx. Each step names an element and shows the note you are reading now. New modules can ship their own guided tours the same way.`;