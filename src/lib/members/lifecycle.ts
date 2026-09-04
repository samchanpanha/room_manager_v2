/// Member lifecycle machine (INTENT.md M02):
/// prospect → verified → active → notice → moved_out.
export const MEMBER_STATUSES = ["prospect", "verified", "active", "notice", "moved_out"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const MEMBER_TRANSITIONS: Record<MemberStatus, MemberStatus[]> = {
  prospect: ["verified"],
  verified: ["active"],
  active: ["notice", "moved_out"], // moved_out: direct exit (termination/eviction — no notice period tracked)
  notice: ["moved_out"],
  moved_out: []
};

export function isMemberStatus(v: string): v is MemberStatus {
  return (MEMBER_STATUSES as readonly string[]).includes(v);
}

export function canTransition(from: MemberStatus, to: MemberStatus): boolean {
  return MEMBER_TRANSITIONS[from].includes(to);
}

/// What must hold before a transition is allowed.
export type TransitionRequirement =
  | { kind: "none" }
  | { kind: "kyc_complete" } // prospect → verified
  | { kind: "active_lease" }; // verified → active (and beyond, via M05)

export function transitionRequirement(from: MemberStatus, to: MemberStatus): TransitionRequirement {
  if (from === "prospect" && to === "verified") return { kind: "kyc_complete" };
  if (from === "verified" && to === "active") return { kind: "active_lease" };
  return { kind: "none" };
}

/// Blacklist blocks every lifecycle move (M02: blacklist blocks new lease —
/// enforced here so nothing downstream can bypass it).
export function assertTransitionAllowed(
  from: MemberStatus,
  to: MemberStatus,
  blacklisted: boolean
): { ok: true } | { ok: false; code: string; message: string } {
  if (blacklisted) return { ok: false, code: "BLACKLISTED", message: "Member is blacklisted — resolve the flag before any status change" };
  if (!canTransition(from, to)) {
    return { ok: false, code: "INVALID_TRANSITION", message: `Transition ${from} → ${to} is not allowed` };
  }
  return { ok: true };
}
