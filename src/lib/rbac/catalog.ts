/// RBDC catalog — single source of truth for modules, actions, scopes and the
/// default permission matrix (INTENT.md §5). The DB is seeded from here and the
/// snapshot test in tests/matrix.test.ts locks it. Edit both together (§15).

export const ACTIONS = [
  "create",
  "read",
  "update",
  "delete",
  "approve",
  "void",
  "refund",
  "export",
  "config"
] as const;

export type Action = (typeof ACTIONS)[number];

export type Scope = "GLOBAL" | "PROPERTY" | "OWN";

export interface ModuleDef {
  key: string; // M01..M28
  slug: string; // stable identifier used in code, e.g. "properties"
  name: string;
}

export const MODULES: ModuleDef[] = [
  { key: "M01", slug: "users", name: "Users & RBDC" },
  { key: "M02", slug: "members", name: "Members" },
  { key: "M03", slug: "owners", name: "Owners" },
  { key: "M04", slug: "properties", name: "Properties & Rooms" },
  { key: "M05", slug: "leases", name: "Leases" },
  { key: "M06", slug: "rent-engine", name: "Rent Engine" },
  { key: "M07", slug: "invoices", name: "Invoices" },
  { key: "M08", slug: "ledger", name: "Ledger" },
  { key: "M09", slug: "payments", name: "Payments" },
  { key: "M10", slug: "deposits", name: "Deposits" },
  { key: "M11", slug: "utilities", name: "Utilities" },
  { key: "M12", slug: "services", name: "Services" },
  { key: "M13", slug: "qr-payments", name: "QR Payments" },
  { key: "M14", slug: "pos", name: "POS" },
  { key: "M15", slug: "stock", name: "Stock" },
  { key: "M16", slug: "room-moves", name: "Room Moves" },
  { key: "M17", slug: "documents", name: "Documents" },
  { key: "M18", slug: "inspections", name: "Inspections" },
  { key: "M19", slug: "maintenance", name: "Maintenance" },
  { key: "M20", slug: "expenses", name: "Expenses & P&L" },
  { key: "M21", slug: "telegram", name: "Telegram" },
  { key: "M22", slug: "complaints", name: "Complaints" },
  { key: "M23", slug: "attendance", name: "Attendance" },
  { key: "M24", slug: "owner-statements", name: "Owner Statements" },
  { key: "M25", slug: "tenant-portal", name: "Tenant Portal" },
  { key: "M26", slug: "reports", name: "Reports" },
  { key: "M27", slug: "security", name: "Security" },
  { key: "M28", slug: "settings", name: "Settings" },
  { key: "M29", slug: "po", name: "Purchase Orders" },
  { key: "M32", slug: "shortstay", name: "Short Stays (Rent Modules)" },
  { key: "M33", slug: "alerts", name: "Rent Alerts & Notifications" }
];

export const MODULE_BY_KEY = new Map(MODULES.map((m) => [m.key, m]));

export type RoleKey =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "PROPERTY_MANAGER"
  | "ACCOUNTANT"
  | "STAFF"
  | "OWNER"
  | "MEMBER";

export interface RoleDef {
  key: RoleKey;
  name: string;
  description: string;
  isProtected: boolean;
}

export const DEFAULT_ROLES: RoleDef[] = [
  {
    key: "SUPER_ADMIN",
    name: "Super Admin",
    description: "Full access to everything, including RBDC config and destructive actions. Protected role.",
    isProtected: true
  },
  { key: "ADMIN", name: "Admin", description: "Manages the whole organization; no full-delete/config outside RBDC audit.", isProtected: false },
  { key: "PROPERTY_MANAGER", name: "Property Manager", description: "Runs assigned properties: rooms, leases, operations.", isProtected: false },
  { key: "ACCOUNTANT", name: "Accountant", description: "Owns the money: rent engine, invoices, ledger, statements.", isProtected: false },
  { key: "STAFF", name: "Staff", description: "Front-desk and field staff: operational write on assigned properties.", isProtected: false },
  { key: "OWNER", name: "Owner", description: "Property landlord: read-only on own buildings, statements, tickets.", isProtected: false },
  { key: "MEMBER", name: "Member", description: "Tenant/resident: own records only via tenant portal.", isProtected: false }
];

/// Matrix letters per INTENT.md §5. Absent cell = "–" (no access).
/// F=full · M=manage(CRU) · R=read · W=read+operational write · O=own records only
export type MatrixLetter = "F" | "M" | "R" | "W" | "O";

export const MATRIX: Record<RoleKey, Partial<Record<string, MatrixLetter>>> = {
  SUPER_ADMIN: Object.fromEntries(MODULES.map((m) => [m.key, "F" as MatrixLetter])),
  ADMIN: {
    M01: "M", M02: "M", M03: "M", M04: "M", M05: "M", M06: "M", M07: "M", M08: "R",
    M09: "M", M10: "M", M11: "M", M12: "M", M13: "M", M14: "M", M15: "M", M16: "M",
    M17: "M", M18: "M", M19: "M", M20: "M", M21: "M", M22: "M", M23: "M", M24: "M",
    M25: "M", M26: "M", M27: "M", M28: "M", M29: "M", M32: "M", M33: "M"
  },
  PROPERTY_MANAGER: {
    M01: "R", M02: "M", M03: "R", M04: "M", M05: "M", M06: "R", M07: "M", M09: "M",
    M10: "M", M11: "M", M12: "M", M13: "R", M14: "M", M15: "M", M16: "M", M17: "M",
    M18: "M", M19: "M", M20: "R", M22: "M", M23: "M", M24: "R", M26: "M", M28: "R",
    M29: "M", M32: "M", M33: "M"
  },
  ACCOUNTANT: {
    M01: "R", M02: "R", M03: "R", M04: "R", M05: "R", M06: "M", M07: "M", M08: "M",
    M09: "M", M10: "M", M11: "R", M12: "R", M13: "M", M14: "R", M15: "R", M16: "R",
    M17: "R", M20: "M", M23: "R", M24: "M", M26: "M", M28: "R", M29: "R", M32: "R", M33: "M"
  },
  STAFF: {
    M02: "W", M04: "R", M05: "R", M07: "R", M09: "W", M10: "R", M11: "W", M12: "W",
    M13: "W", M14: "W", M15: "W", M16: "W", M17: "R", M18: "W", M19: "W", M20: "W",
    M22: "W", M23: "O", M26: "R", M29: "W", M32: "W", M33: "R"
  },
  OWNER: {
    M02: "R", M03: "O", M04: "R", M05: "R", M07: "R", M08: "O", M09: "R", M10: "R",
    M11: "R", M17: "O", M18: "R", M19: "W", M20: "R", M21: "O", M22: "R", M24: "O", M26: "R"
  },
  MEMBER: {
    M02: "O", M05: "O", M07: "O", M08: "O", M09: "O", M10: "O", M11: "O", M12: "O",
    M13: "O", M16: "O", M17: "O", M18: "O", M19: "O", M21: "O", M22: "O", M25: "O"
  }
};

/// Scope each default role operates at for PROPERTY-scoped capabilities.
export const ROLE_SCOPE: Record<RoleKey, Scope> = {
  SUPER_ADMIN: "GLOBAL",
  ADMIN: "GLOBAL",
  PROPERTY_MANAGER: "PROPERTY",
  ACCOUNTANT: "GLOBAL",
  STAFF: "PROPERTY",
  OWNER: "OWN",
  MEMBER: "OWN"
};

/// Extra actions granted when a cell is "O" (own) for a specific module.
/// Default "O" is read-only; these modules let the record owner act.
export const OWN_ACTION_OVERRIDES: Partial<Record<string, Action[]>> = {
  M02: ["read", "update"],
  M09: ["create", "read"],
  M13: ["create", "read"],
  M16: ["create", "read"],
  M17: ["create", "read"],
  M19: ["create", "read", "update"],
  M21: ["create", "read", "update"],
  M23: ["create", "read"], // O(clock): staff clock themselves in/out
  M22: ["create", "read", "update"],
  M25: ["create", "read", "update"]
};

export interface ExpandedPermission {
  module: string;
  action: Action;
  scope: Scope;
}

/// Expand one matrix letter into concrete (action × scope) permission rows.
export function expandCell(moduleKey: string, letter: MatrixLetter, role: RoleKey): ExpandedPermission[] {
  const scope = ROLE_SCOPE[role];
  switch (letter) {
    case "F":
      return ACTIONS.map((action) => ({ module: moduleKey, action, scope: "GLOBAL" as Scope }));
    case "M":
      return (["create", "read", "update"] as Action[]).map((action) => ({ module: moduleKey, action, scope }));
    case "W":
      return (["create", "read", "update"] as Action[]).map((action) => ({ module: moduleKey, action, scope }));
    case "R":
      return [{ module: moduleKey, action: "read", scope }];
    case "O":
      return (OWN_ACTION_OVERRIDES[moduleKey] ?? ["read"]).map((action) => ({
        module: moduleKey,
        action,
        scope: "OWN" as Scope
      }));
  }
}

/// Full permission set for a default role.
export function expandRole(role: RoleKey): ExpandedPermission[] {
  const cells = MATRIX[role];
  const out: ExpandedPermission[] = [];
  for (const [moduleKey, letter] of Object.entries(cells)) {
    if (letter) out.push(...expandCell(moduleKey, letter, role));
  }
  return out;
}

/// Permission id used in the DB: `${module}:${action}`
export function permissionId(module: string, action: Action): string {
  return `${module}:${action}`;
}
