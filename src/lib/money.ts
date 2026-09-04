/// Money helpers — all stored amounts are integer minor units (INTENT.md §9.1).
/// Org-wide display currency (§M28 locale settings). The admin layout pins it
/// once per request cycle; tests and callers without it keep the USD default.
let ACTIVE_CURRENCY = "USD";
export function setActiveCurrency(currency: string): void {
  if (/^[A-Za-z]{3}$/.test(currency)) ACTIVE_CURRENCY = currency.toUpperCase();
}
export function activeCurrency(): string {
  return ACTIVE_CURRENCY;
}

export function formatMinor(minor: number, currency = ACTIVE_CURRENCY): string {
  const major = minor / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(major);
  } catch {
    return `${currency} ${major.toFixed(2)}`;
  }
}

export function toMinor(major: number): number {
  return Math.round(major * 100);
}
