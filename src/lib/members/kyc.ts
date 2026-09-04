/// KYC checklist (INTENT.md M02): all required doc types must be present and
/// unexpired before move-in (lease activation, M05) — and before `verified`.
export interface KycDocRef {
  docTypeId: string;
  expiryDate: Date | null;
}

export interface KycChecklistResult {
  complete: boolean;
  missing: string[]; // required doc type ids with no valid document
  expired: string[]; // present but expired
}

export function kycChecklist(requiredTypeIds: string[], docs: KycDocRef[], now = new Date()): KycChecklistResult {
  const missing: string[] = [];
  const expired: string[] = [];
  for (const typeId of requiredTypeIds) {
    const matching = docs.filter((d) => d.docTypeId === typeId);
    if (matching.length === 0) {
      missing.push(typeId);
      continue;
    }
    const valid = matching.some((d) => d.expiryDate === null || d.expiryDate.getTime() >= now.getTime());
    if (!valid) expired.push(typeId);
  }
  return { complete: missing.length === 0 && expired.length === 0, missing, expired };
}

/// Documents expiring within `days` are surfaced for expiry reminders
/// (M17: 30/7-day reminders; delivery channels land with Phase 19 comms).
export function isExpiringWithin(expiryDate: Date | null, days: number, now = new Date()): boolean {
  if (!expiryDate) return false;
  const limit = now.getTime() + days * 24 * 60 * 60 * 1000;
  return expiryDate.getTime() <= limit && expiryDate.getTime() >= now.getTime();
}

export function isExpired(expiryDate: Date | null, now = new Date()): boolean {
  return expiryDate !== null && expiryDate.getTime() < now.getTime();
}
