import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  type Action,
  DEFAULT_ROLES,
  MATRIX,
  MODULES,
  expandCell,
  expandRole
} from "@/lib/rbac/catalog";

describe("RBDC default permission matrix (INTENT.md §5)", () => {
  it("covers all 31 modules for Super Admin with F", () => {
    expect(MODULES).toHaveLength(31);
    for (const m of MODULES) expect(MATRIX.SUPER_ADMIN[m.key]).toBe("F");
  });

  it("matches the documented spot cells", () => {
    const expectCell = (role: keyof typeof MATRIX, module: string, letter: string | undefined) =>
      expect(MATRIX[role][module]).toBe(letter);
    // Admin
    expectCell("ADMIN", "M01", "M");
    expectCell("ADMIN", "M08", "R");
    expectCell("ADMIN", "M27", "M");
    // Property Manager
    expectCell("PROPERTY_MANAGER", "M04", "M");
    expectCell("PROPERTY_MANAGER", "M08", undefined);
    expectCell("PROPERTY_MANAGER", "M21", undefined);
    // Accountant
    expectCell("ACCOUNTANT", "M08", "M");
    expectCell("ACCOUNTANT", "M24", "M");
    // Staff
    expectCell("STAFF", "M01", undefined);
    expectCell("STAFF", "M09", "W");
    expectCell("STAFF", "M23", "O");
    // Owner
    expectCell("OWNER", "M19", "W");
    expectCell("OWNER", "M21", "O"); // §15 v1.3 (statement-ready recipient)
    expectCell("OWNER", "M24", "O");
    // Member
    expectCell("MEMBER", "M25", "O");
    expectCell("MEMBER", "M14", undefined);
    expectCell("MEMBER", "M26", undefined);
  });

  it("expansion invariants: F ⊇ delete+config; M/W lack delete, config, approve, void, refund", () => {
    const actionsOf = (role: keyof typeof MATRIX, module: string) =>
      new Set(expandCell(module, MATRIX[role][module]!, role).map((p) => p.action));

    const f = actionsOf("SUPER_ADMIN", "M04");
    for (const a of ACTIONS) expect(f.has(a)).toBe(true);

    for (const letterRole of [["ADMIN", "M04"], ["PROPERTY_MANAGER", "M04"], ["ACCOUNTANT", "M08"]] as const) {
      const m = actionsOf(letterRole[0], letterRole[1]);
      for (const banned of ["delete", "config", "approve", "void", "refund"] as Action[]) {
        expect(m.has(banned)).toBe(false);
      }
      expect(m.has("create")).toBe(true);
      expect(m.has("read")).toBe(true);
      expect(m.has("update")).toBe(true);
    }
  });

  it("O cells are OWN-scoped and honor per-module action overrides", () => {
    const memberPortal = expandCell("M25", "O", "MEMBER");
    expect(memberPortal.every((p) => p.scope === "OWN")).toBe(true);
    expect(new Set(memberPortal.map((p) => p.action))).toEqual(new Set(["create", "read", "update"]));

    const ownerStatement = expandCell("M24", "O", "OWNER");
    expect(ownerStatement.map((p) => p.action)).toEqual(["read"]);
  });

  it("locks the full matrix snapshot (any §5 edit must update this intentionally)", () => {
    expect(MATRIX).toMatchSnapshot();
  });

  it("defines exactly the 7 default roles", () => {
    expect(DEFAULT_ROLES.map((r) => r.key)).toEqual([
      "SUPER_ADMIN",
      "ADMIN",
      "PROPERTY_MANAGER",
      "ACCOUNTANT",
      "STAFF",
      "OWNER",
      "MEMBER"
    ]);
  });

  it("generates 279 permissions (31 modules × 9 actions)", () => {
    expect(MODULES.length * ACTIONS.length).toBe(279);
    // every expanded grant references a module×action that exists
    for (const role of DEFAULT_ROLES) {
      for (const p of expandRole(role.key)) {
        expect(MODULES.some((m) => m.key === p.module)).toBe(true);
        expect(ACTIONS).toContain(p.action);
      }
    }
  });
});
