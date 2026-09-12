import { describe, expect, it, vi } from "vitest";
import { read } from "xlsx";
import { prisma } from "@/lib/db";
import {
  createWorkbookBuffer,
  exportMembersData,
  exportLeasesData,
  exportInvoicesData,
  exportPaymentsData,
  exportRoomsData,
  exportFullWorkspaceWorkbook
} from "@/lib/excel/export-service";

describe("Excel Export Service (XLSX)", () => {
  it("creates a valid Excel workbook buffer with custom sheet names", () => {
    const buffer = createWorkbookBuffer({
      "Test Sheet": [
        { Name: "John Doe", Role: "Admin", Active: true },
        { Name: "Jane Smith", Role: "Member", Active: false }
      ]
    });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Read back buffer
    const workbook = read(buffer, { type: "buffer" });
    expect(workbook.SheetNames).toContain("Test Sheet");
    const sheet = workbook.Sheets["Test Sheet"];
    expect(sheet).toBeDefined();
  });

  it("exports members data correctly", async () => {
    const data = await exportMembersData();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const first = data[0]!;
      expect(first).toHaveProperty("Member ID");
      expect(first).toHaveProperty("Full Name");
      expect(first).toHaveProperty("Email");
      expect(first).toHaveProperty("Status");
      expect(first).toHaveProperty("Open Dues ($)");
    }
  });

  it("exports leases data with formatted terms", async () => {
    const data = await exportLeasesData();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const first = data[0]!;
      expect(first).toHaveProperty("Lease Code");
      expect(first).toHaveProperty("Tenant Name");
      expect(first).toHaveProperty("Monthly Rent ($)");
      expect(first).toHaveProperty("Start Date");
    }
  });

  it("exports invoices data with financial breakdowns", async () => {
    const data = await exportInvoicesData();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const first = data[0]!;
      expect(first).toHaveProperty("Invoice Code");
      expect(first).toHaveProperty("Total ($)");
      expect(first).toHaveProperty("Amount Due ($)");
      expect(first).toHaveProperty("Status");
    }
  });

  it("exports payments data with allocations", async () => {
    const data = await exportPaymentsData();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const first = data[0]!;
      expect(first).toHaveProperty("Payment Code");
      expect(first).toHaveProperty("Payment Method");
      expect(first).toHaveProperty("Total Amount ($)");
      expect(first).toHaveProperty("Status");
    }
  });

  it("exports physical inventory rooms data", async () => {
    const data = await exportRoomsData();
    expect(Array.isArray(data)).toBe(true);
    if (data.length > 0) {
      const first = data[0]!;
      expect(first).toHaveProperty("Property");
      expect(first).toHaveProperty("Room Number");
      expect(first).toHaveProperty("Occupancy Status");
      expect(first).toHaveProperty("Base Monthly Rent ($)");
    }
  });

  it("generates a multi-sheet complete workspace backup workbook", async () => {
    const buffer = await exportFullWorkspaceWorkbook("DEFAULT");
    expect(buffer).toBeInstanceOf(Buffer);

    const workbook = read(buffer, { type: "buffer" });
    expect(workbook.SheetNames).toContain("Overview");
    expect(workbook.SheetNames).toContain("Rooms & Units");
    expect(workbook.SheetNames).toContain("Members & Tenants");
    expect(workbook.SheetNames).toContain("Leases");
    expect(workbook.SheetNames).toContain("Invoices");
    expect(workbook.SheetNames).toContain("Payments");
  });

  it("handles GET /api/export/members API route", async () => {
    const { GET } = await import("@/app/api/export/[entity]/route");
    // vi.mock getAuthUser
    const sessionMod = await import("@/lib/auth/session");
    const user = await prisma.user.findFirstOrThrow({ where: { email: "root@demo.test" } });
    vi.spyOn(sessionMod, "getAuthUser").mockResolvedValueOnce({
      id: user.id,
      name: user.name,
      email: user.email,
      partyId: user.partyId,
      tenantId: "DEFAULT",
      roles: ["SUPER_ADMIN"],
      sessionId: "test-sess",
      isSuperAdmin: true,
      totpEnrollmentRequired: false,
      mustChangePassword: false,
      propertyIds: [],
      permissions: [
        { module: "M02", action: "read", scope: "GLOBAL" },
        { module: "M02", action: "export", scope: "GLOBAL" }
      ]
    });

    const req = new Request("http://localhost/api/export/members");
    const res = await GET(req, { params: Promise.resolve({ entity: "members" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("spreadsheetml");
    expect(res.headers.get("Content-Disposition")).toContain("attachment; filename=\"members-");
    const arrayBuffer = await res.arrayBuffer();
    expect(arrayBuffer.byteLength).toBeGreaterThan(0);
  });
});
