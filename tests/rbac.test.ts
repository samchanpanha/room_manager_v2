import { describe, expect, it } from "vitest";
import { can, type Subject } from "@/lib/rbac/can";
import { expandRole, type RoleKey } from "@/lib/rbac/catalog";

function makeSubject(role: RoleKey, opts?: { id?: string; propertyIds?: string[] }): Subject {
  return {
    id: opts?.id ?? "user_1",
    propertyIds: opts?.propertyIds ?? [],
    permissions: expandRole(role)
  };
}

const P1 = "property_blr";
const P2 = "property_rv";

describe("RBDC can() enforcement — positive cases", () => {
  it("Super Admin passes everything, everywhere", () => {
    const root = makeSubject("SUPER_ADMIN");
    expect(can(root, "delete", "M01")).toBe(true);
    expect(can(root, "config", "M28", { propertyId: P2 })).toBe(true);
    expect(can(root, "void", "M07")).toBe(true);
  });

  it("Property Manager with assignment can manage rooms in the assigned property", () => {
    const pm = makeSubject("PROPERTY_MANAGER", { propertyIds: [P1] });
    expect(can(pm, "update", "M04", { propertyId: P1 })).toBe(true);
    expect(can(pm, "create", "M04", { propertyId: P1 })).toBe(true);
  });

  it("Accountant has global finance rights", () => {
    const acc = makeSubject("ACCOUNTANT");
    expect(can(acc, "update", "M08")).toBe(true);
    expect(can(acc, "read", "M04")).toBe(true);
  });

  it("Staff can operationally write complaints in an assigned property", () => {
    const staff = makeSubject("STAFF", { propertyIds: [P1] });
    expect(can(staff, "create", "M22", { propertyId: P1 })).toBe(true);
  });

  it("Member OWN-scope portal rights resolve for own records", () => {
    const member = makeSubject("MEMBER", { id: "member_9" });
    expect(can(member, "read", "M07", { ownerUserId: "member_9" })).toBe(true);
    expect(can(member, "create", "M19", { ownerUserId: "member_9" })).toBe(true);
  });
});

describe("RBDC can() enforcement — negative cases (CI-required)", () => {
  it("Staff cannot touch Users/RBDC at all", () => {
    const staff = makeSubject("STAFF");
    expect(can(staff, "read", "M01")).toBe(false);
    expect(can(staff, "create", "M01")).toBe(false);
    expect(can(staff, "update", "M01")).toBe(false);
  });

  it("IDOR across properties: PM assigned to BLR cannot mutate Riverside Villa (RV)", () => {
    const pm = makeSubject("PROPERTY_MANAGER", { propertyIds: [P1] });
    expect(can(pm, "update", "M04", { propertyId: P2 })).toBe(false);
    expect(can(pm, "create", "M04", { propertyId: P2 })).toBe(false);
  });

  it("Accountant can read rooms but not create/update them", () => {
    const acc = makeSubject("ACCOUNTANT");
    expect(can(acc, "read", "M04")).toBe(true);
    expect(can(acc, "create", "M04")).toBe(false);
    expect(can(acc, "update", "M04", { propertyId: P1 })).toBe(false);
  });

  it("Member cannot read another member's invoices (OWN scope violation blocked)", () => {
    const member = makeSubject("MEMBER", { id: "member_9" });
    expect(can(member, "read", "M07", { ownerUserId: "member_8" })).toBe(false);
    expect(can(member, "read", "M07")).toBe(false);
  });

  it("Staff lacks finance actions: no ledger access, no invoice void", () => {
    const staff = makeSubject("STAFF", { propertyIds: [P1] });
    expect(can(staff, "update", "M08")).toBe(false);
    expect(can(staff, "void", "M07")).toBe(false);
    expect(can(staff, "refund", "M09")).toBe(false);
  });

  it("PROPERTY scope without assignment and without resource context fails closed", () => {
    const pm = makeSubject("PROPERTY_MANAGER"); // no property assignments
    expect(can(pm, "update", "M04")).toBe(false);
    expect(can(pm, "update", "M04", { propertyId: P1 })).toBe(false);
  });

  it("M02/M17: staff can onboard members + upload docs only in assigned properties", () => {
    const staff = makeSubject("STAFF", { propertyIds: [P1] });
    expect(can(staff, "create", "M02", { propertyId: P1 })).toBe(true);
    expect(can(staff, "create", "M02", { propertyId: P2 })).toBe(false);
    expect(can(staff, "create", "M17", { propertyId: P1 })).toBe(false); // staff M17 = read only
    const pm = makeSubject("PROPERTY_MANAGER", { propertyIds: [P1] });
    expect(can(pm, "create", "M17", { propertyId: P1 })).toBe(true);
    expect(can(pm, "read", "M17", { propertyId: P2 })).toBe(false); // cross-property doc fetch blocked
  });

  it("M03: owners are OWN-scoped — see own record, not other owners'; no mutations", () => {
    const owner = makeSubject("OWNER", { id: "owner_user_1" });
    expect(can(owner, "read", "M03", { ownerUserId: "owner_user_1" })).toBe(true);
    expect(can(owner, "read", "M03", { ownerUserId: "owner_user_2" })).toBe(false);
    expect(can(owner, "read", "M03")).toBe(false); // no listing without resource
    expect(can(owner, "update", "M03", { ownerUserId: "owner_user_1" })).toBe(false); // O = read-only
    expect(can(owner, "create", "M03")).toBe(false);
  });

  it("M03: staff has no access; PM read is property-scoped (fails closed without assignment)", () => {
    const staff = makeSubject("STAFF");
    expect(can(staff, "read", "M03")).toBe(false);
    expect(can(staff, "create", "M03")).toBe(false);
    const pmUnassigned = makeSubject("PROPERTY_MANAGER");
    expect(can(pmUnassigned, "read", "M03")).toBe(false);
  });

  it("M04 owner reads resolve via ownerUserId resource (own buildings)", () => {
    const owner = makeSubject("OWNER", { id: "owner_user_1" });
    expect(can(owner, "read", "M04", { ownerUserId: "owner_user_1" })).toBe(true);
    expect(can(owner, "update", "M04", { ownerUserId: "owner_user_1" })).toBe(false); // matrix: read only
  });

  it("M05: member OWN-scope reads own lease; staff read-only; accountant read", () => {
    const member = makeSubject("MEMBER", { id: "member_9" });
    expect(can(member, "read", "M05", { ownerUserId: "member_9" })).toBe(true);
    expect(can(member, "read", "M05", { ownerUserId: "other" })).toBe(false);
    expect(can(member, "create", "M05")).toBe(false);
    const staff = makeSubject("STAFF", { propertyIds: [P1] });
    expect(can(staff, "read", "M05", { propertyId: P1 })).toBe(true);
    expect(can(staff, "update", "M05", { propertyId: P1 })).toBe(false); // staff M05 = read
    const acc = makeSubject("ACCOUNTANT");
    expect(can(acc, "read", "M05")).toBe(true);
    expect(can(acc, "create", "M05")).toBe(false);
  });

  it("unknown module/action pairs fail closed", () => {
    const admin = makeSubject("ADMIN");
    expect(can(admin, "read", "M99" as string)).toBe(false);
    expect(can(admin, "nonaction" as never, "M04")).toBe(false);
  });
});
