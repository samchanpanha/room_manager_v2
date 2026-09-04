import { describe, expect, it } from "vitest";
import {
  LEASE_STATUSES,
  LEASE_TRANSITIONS,
  canLeaseTransition,
  isLeaseStatus,
  isOwnerContractStatus,
  OWNER_CONTRACT_TRANSITIONS
} from "@/lib/leases/machine";

describe("Lease state machine (M05)", () => {
  it("happy path: draft → active → notice → completed", () => {
    expect(canLeaseTransition("draft", "active")).toBe(true);
    expect(canLeaseTransition("active", "notice")).toBe(true);
    expect(canLeaseTransition("notice", "completed")).toBe(true);
  });

  it("termination is reachable from active and notice", () => {
    expect(canLeaseTransition("active", "terminated")).toBe(true);
    expect(canLeaseTransition("notice", "terminated")).toBe(true);
    expect(canLeaseTransition("draft", "terminated")).toBe(false);
  });

  it("direct completion from active is allowed (natural end handling)", () => {
    expect(canLeaseTransition("active", "completed")).toBe(true);
  });

  it("invalid transitions rejected", () => {
    expect(canLeaseTransition("draft", "notice")).toBe(false);
    expect(canLeaseTransition("completed", "active")).toBe(false);
    expect(canLeaseTransition("terminated", "active")).toBe(false);
    expect(canLeaseTransition("notice", "active")).toBe(false);
  });

  it("terminal states have no exits; drafts are the only entry", () => {
    expect(LEASE_TRANSITIONS.terminated).toHaveLength(0);
    expect(LEASE_TRANSITIONS.completed).toHaveLength(0);
    expect(LEASE_STATUSES).toContain("draft");
    expect(isLeaseStatus("active")).toBe(true);
    expect(isLeaseStatus("paused")).toBe(false);
  });
});

describe("Owner contract state machine (M05)", () => {
  it("draft → active → terminated | expired; no resurrection", () => {
    expect(OWNER_CONTRACT_TRANSITIONS.draft).toEqual(["active"]);
    expect(OWNER_CONTRACT_TRANSITIONS.active).toEqual(["terminated", "expired"]);
    expect(OWNER_CONTRACT_TRANSITIONS.terminated).toHaveLength(0);
    expect(OWNER_CONTRACT_TRANSITIONS.expired).toHaveLength(0);
    expect(isOwnerContractStatus("active")).toBe(true);
    expect(isOwnerContractStatus("drafted")).toBe(false);
  });
});
