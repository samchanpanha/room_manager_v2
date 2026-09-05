/// Navigation model — shared by the sidebar (UI) and the roadmap.
/// `module` gates visibility via RBDC; `phase` marks unbuilt stubs (disabled, labeled).
export interface NavItem {
  label: string;
  href?: string;
  module?: string;
  phase?: number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    label: "nav.overview",
    items: [{ label: "Dashboard", href: "/dashboard" }]
  },
  {
    label: "nav.portfolio",
    items: [
      { label: "Properties", href: "/properties", module: "M04" },
      { label: "Members", href: "/members", module: "M02" },
      { label: "Owners", href: "/owners", module: "M03" },
      { label: "Owner Portal", href: "/owners/portal", module: "OWNER_PORTAL" },
      { label: "Leases", module: "M05", phase: 5 }
    ]
  },
  {
    label: "nav.billing",
    items: [
      { label: "Rent Engine", href: "/rent-engine", module: "M06" },
      { label: "Invoices", href: "/invoices", module: "M07" },
      { label: "Payments", href: "/payments", module: "M09" },
      { label: "Deposits", href: "/deposits", module: "M10" },
      { label: "Utilities", href: "/utilities", module: "M11" },
      { label: "Services", href: "/services", module: "M12" }
      // M13 QR payments intentionally has no admin page: the pay-by-QR flow
      // lives on each open invoice (+ the public poster at /pay, no nav entry).
    ]
  },
  {
    label: "nav.finance",
    items: [
      { label: "Ledger", href: "/ledger", module: "M08" },
      { label: "Expenses & P&L", href: "/expenses", module: "M20" },
      { label: "Owner Statements", href: "/statements", module: "M24" }
    ]
  },
  {
    label: "nav.operations",
    items: [
      { label: "Room Moves", href: "/moves", module: "M16" },
      { label: "Inspections", href: "/inspections", module: "M18" },
      { label: "Maintenance", href: "/maintenance", module: "M19" },
      { label: "Complaints", href: "/complaints", module: "M22" },
      { label: "POS", href: "/pos", module: "M14" },
      { label: "POS Catalog", href: "/pos/products", module: "M14" },
      { label: "Stock", href: "/stock", module: "M15" },
      { label: "Short Stays", href: "/stay", module: "M32" },
      { label: "Purchase Orders", href: "/po", module: "M29" },
      { label: "Attendance", href: "/attendance", module: "M23" }
    ]
  },
  {
    label: "nav.comms",
    items: [
      { label: "Tenant Portal", href: "/portal", module: "M25" },
      { label: "Telegram Bot", href: "/telegram", module: "M21" }
    ]
  },
  {
    label: "nav.insights",
    items: [{ label: "Reports", href: "/reports", module: "M26" }]
  },
  {
    label: "nav.admin",
    items: [
      { label: "Users", href: "/users", module: "M01" },
      { label: "Roles & Permissions", href: "/roles", module: "M01" },
      { label: "Audit Log", href: "/audit", module: "M01" },
      { label: "Settings", href: "/settings", module: "M28" },
      { label: "Security", href: "/settings/security", module: "M27" }
    ]
  }
];
