import { describe, expect, it } from "vitest";
import { isExpired, isExpiringWithin, kycChecklist } from "@/lib/members/kyc";

const NOW = new Date("2026-09-02T00:00:00.000Z");
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

describe("KYC checklist (M02)", () => {
  it("complete when every required type has an unexpired document", () => {
    const r = kycChecklist(
      ["passport", "national_id", "employment_contract"],
      [
        { docTypeId: "passport", expiryDate: days(365) },
        { docTypeId: "national_id", expiryDate: null },
        { docTypeId: "employment_contract", expiryDate: null }
      ],
      NOW
    );
    expect(r.complete).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.expired).toEqual([]);
  });

  it("reports missing required types", () => {
    const r = kycChecklist(["passport", "employment_contract"], [{ docTypeId: "passport", expiryDate: days(30) }], NOW);
    expect(r.complete).toBe(false);
    expect(r.missing).toEqual(["employment_contract"]);
  });

  it("treats an expired document as missing validity", () => {
    const r = kycChecklist(["passport"], [{ docTypeId: "passport", expiryDate: days(-1) }], NOW);
    expect(r.complete).toBe(false);
    expect(r.expired).toEqual(["passport"]);
  });

  it("a valid re-upload (newer version) satisfies the checklist", () => {
    const r = kycChecklist(
      ["passport"],
      [
        { docTypeId: "passport", expiryDate: days(-5) },
        { docTypeId: "passport", expiryDate: days(300) }
      ],
      NOW
    );
    expect(r.complete).toBe(true);
  });

  it("extra documents do not break completeness", () => {
    const r = kycChecklist(["national_id"], [
      { docTypeId: "national_id", expiryDate: days(10) },
      { docTypeId: "visa", expiryDate: days(100) },
      { docTypeId: "other", expiryDate: null }
    ], NOW);
    expect(r.complete).toBe(true);
  });
});

describe("Expiry helpers (M17 reminders 30/7 days)", () => {
  it("flags expiring within the window", () => {
    expect(isExpiringWithin(days(29), 30, NOW)).toBe(true);
    expect(isExpiringWithin(days(6), 7, NOW)).toBe(true);
    expect(isExpiringWithin(days(31), 30, NOW)).toBe(false);
  });

  it("never flags null or already-expired dates as expiring-soon", () => {
    expect(isExpiringWithin(null, 30, NOW)).toBe(false);
    expect(isExpiringWithin(days(-2), 30, NOW)).toBe(false);
    expect(isExpired(days(-2), NOW)).toBe(true);
    expect(isExpired(days(2), NOW)).toBe(false);
  });
});
