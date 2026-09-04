import { describe, expect, it } from "vitest";
import {
  MEMBER_STATUSES,
  MEMBER_TRANSITIONS,
  assertTransitionAllowed,
  canTransition,
  isMemberStatus,
  transitionRequirement
} from "@/lib/members/lifecycle";

describe("Member lifecycle machine (M02)", () => {
  it("happy path: prospect → verified → active → notice → moved_out", () => {
    expect(canTransition("prospect", "verified")).toBe(true);
    expect(canTransition("verified", "active")).toBe(true);
    expect(canTransition("active", "notice")).toBe(true);
    expect(canTransition("notice", "moved_out")).toBe(true);
  });

  it("direct move-out from active is allowed (termination/eviction path)", () => {
    expect(canTransition("active", "moved_out")).toBe(true);
  });

  it("invalid transitions are rejected", () => {
    expect(canTransition("prospect", "active")).toBe(false); // must be verified first
    expect(canTransition("verified", "notice")).toBe(false);
    expect(canTransition("active", "verified")).toBe(false);
    expect(canTransition("moved_out", "active")).toBe(false);
    expect(canTransition("prospect", "moved_out")).toBe(false);
  });

  it("moved_out is terminal; every other status has an exit", () => {
    expect(MEMBER_TRANSITIONS.moved_out).toHaveLength(0);
    for (const s of MEMBER_STATUSES) {
      if (s === "moved_out") continue;
      expect(MEMBER_TRANSITIONS[s].length).toBeGreaterThan(0);
    }
  });

  it("requirements: verified needs KYC, active needs a lease", () => {
    expect(transitionRequirement("prospect", "verified")).toEqual({ kind: "kyc_complete" });
    expect(transitionRequirement("verified", "active")).toEqual({ kind: "active_lease" });
    expect(transitionRequirement("active", "notice")).toEqual({ kind: "none" });
    expect(transitionRequirement("notice", "moved_out")).toEqual({ kind: "none" });
  });

  it("blacklist blocks every transition, even valid ones", () => {
    const blocked = assertTransitionAllowed("prospect", "verified", true);
    expect(blocked).toMatchObject({ ok: false, code: "BLACKLISTED" });
    expect(assertTransitionAllowed("verified", "active", true)).toMatchObject({ ok: false, code: "BLACKLISTED" });
    expect(assertTransitionAllowed("active", "notice", true)).toMatchObject({ ok: false, code: "BLACKLISTED" });
  });

  it("non-blacklisted members pass the gate only for valid transitions", () => {
    expect(assertTransitionAllowed("prospect", "verified", false)).toEqual({ ok: true });
    expect(assertTransitionAllowed("prospect", "active", false)).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("guards", () => {
    expect(isMemberStatus("verified")).toBe(true);
    expect(isMemberStatus("paused")).toBe(false);
  });
});
