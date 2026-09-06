/// Map nav labels, module keys and routes to the shared Icon set.

import type { IconName } from "@/components/icon";

/// Sidebar / quick-launch: pick an icon per nav item label (labels are unique).
export function navIcon(label: string): IconName {
  switch (label) {
    case "Dashboard": return "home";
    case "Properties": return "building";
    case "Members": return "users";
    case "Owners": return "key";
    case "Owner Portal": return "external";
    case "Tenant Portal": return "external";
    case "Leases": return "book";
    case "Rent Engine": return "calculator";
    case "Invoices": return "receipt";
    case "Payments": return "banknote";
    case "Deposits": return "coins";
    case "Utilities": return "gauge";
    case "Services": return "tag";
    case "Ledger": return "book";
    case "Expenses & P&L": return "wallet";
    case "Owner Statements": return "trending-up";
    case "Room Moves": return "shuffle";
    case "Inspections": return "clipboard-check";
    case "Maintenance": return "wrench";
    case "Complaints": return "megaphone";
    case "POS": return "cart";
    case "POS Catalog": return "package";
    case "Stock": return "archive";
    case "Purchase Orders": return "file-plus";
    case "Attendance": return "clock";
    case "My Account": return "user";
    case "Help & Guide": return "book";
    case "Telegram Bot": return "send";
    case "Reports": return "chart";
    case "Users": return "user";
    case "Roles & Permissions": return "shield";
    case "Audit Log": return "list";
    case "Settings": return "sliders";
    case "Security": return "shield";
    case "Members & Documents": return "users";
    default: return "sparkle";
  }
}

/// Module key (M01…) / pseudo-key (OWNER_PORTAL) → icon, for tab dots and guide.
export function moduleIcon(key?: string): IconName {
  switch (key) {
    case "M01": return "sliders";
    case "M02": return "users";
    case "M03": return "key";
    case "M04": return "building";
    case "M05": return "book";
    case "M06": return "calculator";
    case "M07": return "receipt";
    case "M08": return "book";
    case "M09": return "banknote";
    case "M10": return "coins";
    case "M11": return "gauge";
    case "M12": return "tag";
    case "M14": return "cart";
    case "M15": return "archive";
    case "M16": return "shuffle";
    case "M18": return "clipboard-check";
    case "M19": return "wrench";
    case "M20": return "wallet";
    case "M21": return "send";
    case "M22": return "megaphone";
    case "M23": return "clock";
    case "M24": return "trending-up";
    case "M25": return "external";
    case "M26": return "chart";
    case "M27": return "shield";
    case "M28": return "sliders";
    case "M29": return "file-plus";
    case "M32": return "clock";
    case "OWNER_PORTAL": return "external";
    case "HOME": return "home";
    default: return "sparkle";
  }
}

/// Group label → icon, for group headers.
export function navGroupIcon(label: string): IconName {
  switch (label) {
    case "nav.overview": return "grid";
    case "nav.portfolio": return "building";
    case "nav.billing": return "receipt";
    case "nav.finance": return "wallet";
    case "nav.operations": return "wrench";
    case "nav.store": return "archive";
    case "nav.comms": return "message";
    case "nav.insights": return "chart";
    case "nav.admin": return "shield";
    case "nav.account": return "user";
    default: return "sparkle";
  }
}