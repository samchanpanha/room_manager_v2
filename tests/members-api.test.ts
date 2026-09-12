import { describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth/session", () => ({
  getAuthUser: vi.fn(async () => {
    const user = await prisma.user.findFirstOrThrow({ where: { email: "root@demo.test" } });
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      propertyIds: [],
      permissions: [
        { module: "M02", action: "read", scope: "GLOBAL" },
        { module: "M09", action: "create", scope: "GLOBAL" }
      ]
    };
  })
}));

import { GET } from "@/app/api/members/route";

describe("Members API GET /api/members (M02 / M09 integration)", () => {
  it("returns member profiles with party info and active/draft lease details", async () => {
    const req = new Request("http://localhost/api/members");
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.members).toBeDefined();
    expect(Array.isArray(body.members)).toBe(true);
    expect(body.members.length).toBeGreaterThan(0);

    const first = body.members[0];
    expect(first.id).toBeTruthy();
    expect(first.party).toBeDefined();
    expect(first.party.name).toBeTruthy();
    expect(Array.isArray(first.leases)).toBe(true);
  });

  it("filters members by search query q", async () => {
    const firstMember = await prisma.memberProfile.findFirstOrThrow({
      include: { party: true }
    });
    const query = firstMember.party.name.slice(0, 4);

    const req = new Request(`http://localhost/api/members?q=${encodeURIComponent(query)}`);
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.members.length).toBeGreaterThan(0);
    const found = body.members.some((m: { id: string }) => m.id === firstMember.id);
    expect(found).toBe(true);
  });
});
