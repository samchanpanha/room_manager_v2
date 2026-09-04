/// Invoice state machine (INTENT.md M07):
/// draft → issued → partial_paid → paid · issued/partial_paid → overdue ·
/// any live state → void (reason required). paid & void are terminal.
export const INVOICE_STATUSES = ["draft", "issued", "partial_paid", "paid", "overdue", "void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ["issued", "void"],
  issued: ["partial_paid", "paid", "overdue", "void"],
  partial_paid: ["paid", "overdue", "void"],
  overdue: ["partial_paid", "paid", "void"],
  paid: [],
  void: []
};

export function isInvoiceStatus(v: string): v is InvoiceStatus {
  return (INVOICE_STATUSES as readonly string[]).includes(v);
}

export function canInvoiceTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return INVOICE_TRANSITIONS[from].includes(to);
}

export const INVOICE_ITEM_KINDS = ["rent", "service", "utility", "one_time", "late_fee", "credit", "deposit"] as const;
export type InvoiceItemKind = (typeof INVOICE_ITEM_KINDS)[number];

export function isInvoiceItemKind(v: string): v is InvoiceItemKind {
  return (INVOICE_ITEM_KINDS as readonly string[]).includes(v);
}
