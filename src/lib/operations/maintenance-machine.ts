/// M19 Maintenance + M22 Complaints — pure rules: status machines, SLA
/// targets and cost math. DB work lives in maintenance-service.ts /
/// complaints-service.ts.
import type { FindingSeverity } from "./inspections-machine";

// ── M19 tickets ──────────────────────────────────────────────────────────────

export const TICKET_STATUSES = ["open", "assigned", "in_progress", "resolved", "verified", "closed", "cancelled"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ["assigned", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["resolved"],
  resolved: ["verified", "closed"],
  verified: ["closed"],
  closed: [],
  cancelled: []
};

export function canTicketTransition(from: string, to: string): boolean {
  if (!(TICKET_STATUSES as readonly string[]).includes(from)) return false;
  if (!(TICKET_STATUSES as readonly string[]).includes(to)) return false;
  return TICKET_TRANSITIONS[from as TicketStatus].includes(to as TicketStatus);
}

export const TICKET_CATEGORIES = ["plumbing", "electrical", "appliance", "furniture", "internet", "other"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

/// SLA target hours by priority (§M19 "SLA target").
export const TICKET_SLA_HOURS: Record<TicketPriority, number> = {
  urgent: 4,
  high: 24,
  medium: 72,
  low: 168
};

export function ticketSlaDueAt(priority: string, from: Date): Date | null {
  if (!(TICKET_PRIORITIES as readonly string[]).includes(priority)) return null;
  return new Date(from.getTime() + TICKET_SLA_HOURS[priority as TicketPriority] * 3_600_000);
}

export const COST_KINDS = ["labor", "material"] as const;
export type CostKind = (typeof COST_KINDS)[number];
export const COST_TARGETS = ["expense", "owner"] as const;
export type CostTarget = (typeof COST_TARGETS)[number];

export interface CostLine {
  kind: CostKind;
  label: string;
  amountMinor: number;
  chargeTo?: CostTarget;
}

export function totalCostMinor(lines: CostLine[]): number {
  return lines.reduce((sum, c) => sum + c.amountMinor, 0);
}

// ── M22 complaints ───────────────────────────────────────────────────────────

export const COMPLAINT_STATUSES = ["new", "acknowledged", "in_progress", "resolved", "closed"] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const COMPLAINT_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  new: ["acknowledged"],
  acknowledged: ["in_progress", "resolved"],
  in_progress: ["resolved"],
  resolved: ["closed"],
  closed: []
};

export function canComplaintTransition(from: string, to: string): boolean {
  if (!(COMPLAINT_STATUSES as readonly string[]).includes(from)) return false;
  if (!(COMPLAINT_STATUSES as readonly string[]).includes(to)) return false;
  return COMPLAINT_TRANSITIONS[from as ComplaintStatus].includes(to as ComplaintStatus);
}

export const COMPLAINT_CATEGORIES = ["noise", "cleanliness", "neighbor", "staff", "facility", "billing", "other"] as const;
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export const COMPLAINT_PRIORITIES = ["low", "medium", "high"] as const;
export type ComplaintPriority = (typeof COMPLAINT_PRIORITIES)[number];

/// SLA target hours by priority (§M22 "SLA by priority").
export const COMPLAINT_SLA_HOURS: Record<ComplaintPriority, number> = {
  high: 24,
  medium: 72,
  low: 168
};

export function complaintSlaDueAt(priority: string, from: Date): Date | null {
  if (!(COMPLAINT_PRIORITIES as readonly string[]).includes(priority)) return null;
  return new Date(from.getTime() + COMPLAINT_SLA_HOURS[priority as ComplaintPriority] * 3_600_000);
}

/// Member rating on close (§M22 "member confirms resolution and rates").
export function isValidRating(v: number): boolean {
  return Number.isInteger(v) && v >= 1 && v <= 5;
}

export type { FindingSeverity };
