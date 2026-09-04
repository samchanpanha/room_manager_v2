/// Lease & owner contract state machines (INTENT.md M05).
/// Member lease: draft → active → notice → terminated | completed
/// (terminated reachable from active or notice — early exit with clearance).
export const LEASE_STATUSES = ["draft", "active", "notice", "terminated", "completed"] as const;
export type LeaseStatus = (typeof LEASE_STATUSES)[number];

export const LEASE_TRANSITIONS: Record<LeaseStatus, LeaseStatus[]> = {
  draft: ["active"],
  active: ["notice", "terminated", "completed"],
  notice: ["terminated", "completed"],
  terminated: [],
  completed: []
};

export function isLeaseStatus(v: string): v is LeaseStatus {
  return (LEASE_STATUSES as readonly string[]).includes(v);
}

export function canLeaseTransition(from: LeaseStatus, to: LeaseStatus): boolean {
  return LEASE_TRANSITIONS[from].includes(to);
}

/// Owner contract: draft → active → terminated | expired.
export const OWNER_CONTRACT_STATUSES = ["draft", "active", "terminated", "expired"] as const;
export type OwnerContractStatus = (typeof OWNER_CONTRACT_STATUSES)[number];

export const OWNER_CONTRACT_TRANSITIONS: Record<OwnerContractStatus, OwnerContractStatus[]> = {
  draft: ["active"],
  active: ["terminated", "expired"],
  terminated: [],
  expired: []
};

export function isOwnerContractStatus(v: string): v is OwnerContractStatus {
  return (OWNER_CONTRACT_STATUSES as readonly string[]).includes(v);
}
