import { describe, expect, it } from "vitest";
import { signDownloadToken, verifyDownloadToken } from "@/lib/storage/signing";

describe("Signed document URLs (M17)", () => {
  it("round-trips a valid token to its document id", () => {
    const token = signDownloadToken("doc_123", 60);
    const result = verifyDownloadToken(token);
    expect(result).toEqual({ docId: "doc_123" });
  });

  it("rejects tampered payloads", () => {
    const token = signDownloadToken("doc_123", 60);
    const idx = token.lastIndexOf(".");
    const body = Buffer.from(token.slice(0, idx), "base64url").toString();
    const forged = Buffer.from(body.replace("doc_123", "doc_999")).toString("base64url");
    expect(verifyDownloadToken(`${forged}.${token.slice(idx + 1)}`)).toBeNull();
  });

  it("rejects expired tokens", () => {
    const token = signDownloadToken("doc_123", -1); // already expired
    expect(verifyDownloadToken(token)).toBeNull();
  });

  it("rejects garbage and wrong signatures", () => {
    expect(verifyDownloadToken("not-a-token")).toBeNull();
    expect(verifyDownloadToken("abc.def")).toBeNull();
    const good = signDownloadToken("doc_abc", 60);
    const idx = good.lastIndexOf(".");
    expect(verifyDownloadToken(`${good.slice(0, idx)}.AAAA${good.slice(idx + 1)}`)).toBeNull();
  });

  it("tokens are unique per issuance (nonce)", () => {
    expect(signDownloadToken("doc_x")).not.toBe(signDownloadToken("doc_x"));
  });
});
