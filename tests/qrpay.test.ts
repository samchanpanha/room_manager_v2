/**
 * M13 QR Payments — pure pieces: the DevMock adapter (§M13 interface) and the
 * signed member QR tokens (pay-without-login). No DB.
 */
import { describe, expect, it } from "vitest";
import { devMockProvider, resolveProvider } from "@/lib/qrpay/adapter";
import { signMemberToken, verifyMemberToken } from "@/lib/qrpay/tokens";

describe("DevMock adapter", () => {
  it("generates a QR charge with scheme, image and expiry (generateQR §M13)", async () => {
    const charge = await devMockProvider.generateQR({ amountMinor: 25000, ref: "QRPAY-ABC123", orgAccount: "Demo Living Co." });
    expect(charge.provider).toBe("devmock");
    expect(charge.qrString).toBe("devmock://pay?ref=QRPAY-ABC123&amt=25000&acct=Demo%20Living%20Co.");
    expect(charge.imageDataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(charge.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects non-integer/non-positive amounts and empty refs", async () => {
    await expect(devMockProvider.generateQR({ amountMinor: 1.5, ref: "X", orgAccount: "o" })).rejects.toThrow(/positive integer/);
    await expect(devMockProvider.generateQR({ amountMinor: 0, ref: "X", orgAccount: "o" })).rejects.toThrow();
    await expect(devMockProvider.generateQR({ amountMinor: 100, ref: "", orgAccount: "o" })).rejects.toThrow(/ref/);
  });

  it("parses devmock webhooks onto the generic shape (handleWebhook §M13)", () => {
    const okOne = devMockProvider.parseWebhook({ provider: "devmock", type: "qr_payment", ref: "QRPAY-ABC123", status: "success" });
    expect(okOne).toMatchObject({ provider: "devmock", gatewayRef: "QRPAY-ABC123", status: "confirmed" });
    const failed = devMockProvider.parseWebhook({ provider: "devmock", type: "qr_payment", ref: "QRPAY-1", status: "failed", reason: "declined" });
    expect(failed).toMatchObject({ status: "failed", reason: "declined" });
    expect(devMockProvider.parseWebhook({ provider: "devmock", type: "qr_payment", status: "success" })).toBeNull(); // no ref
    expect(devMockProvider.parseWebhook({ provider: "devmock", type: "qr_payment", ref: "R", status: "weird" })).toBeNull();
    expect(devMockProvider.parseWebhook({ provider: "other", type: "qr_payment", ref: "R", status: "success" })).toBeNull();
    expect(devMockProvider.parseWebhook("garbage")).toBeNull();
  });

  it("resolves DevMock by default (DevMock first §M13)", () => {
    expect(resolveProvider().name).toBe("devmock");
    expect(resolveProvider("devmock").name).toBe("devmock");
  });
});

describe("member QR tokens (pay-without-login)", () => {
  it("round-trips a signed member token", () => {
    const token = signMemberToken("member-123");
    expect(verifyMemberToken(token)).toBe("member-123");
  });

  it("rejects tampered or malformed tokens", () => {
    const token = signMemberToken("member-123");
    const [id, mac] = token.split(".");
    expect(verifyMemberToken(`${id}.${mac.slice(0, -2)}aa`)).toBeNull();
    expect(verifyMemberToken("other-member" + token.slice("member-123".length))).toBeNull();
    expect(verifyMemberToken("garbage")).toBeNull();
    expect(verifyMemberToken(".")).toBeNull();
  });

  it("binds the signature to the member id (token for A does not verify as B)", () => {
    const token = signMemberToken("member-A");
    expect(verifyMemberToken(token)).toBe("member-A");
    expect(verifyMemberToken(`member-B.${token.split(".")[1]}`)).toBeNull();
  });
});
