package com.rentmanager.finance.ledger.spi;

import com.rentmanager.billing.spi.LedgerPostingPort;
import com.rentmanager.finance.ledger.service.ChartOfAccounts;
import com.rentmanager.finance.ledger.service.LedgerService;
import com.rentmanager.finance.ledger.service.Postings;
import com.rentmanager.finance.ledger.service.Postings.Line;
import java.util.ArrayList;
import java.util.List;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/**
 * Finance's implementation of the billing {@link LedgerPostingPort} (INTENT.md
 * M08): turns invoice / payment / deposit domain events into balanced
 * double-entry postings. Registering this {@code @Primary} bean replaces
 * billing's no-op default, so the whole invoice→payment→deposit lifecycle posts
 * to the ledger. Dependency inversion — billing never imports finance.
 */
@Component
@Primary
public class LedgerPostingAdapter implements LedgerPostingPort {

  private final LedgerService ledger;

  public LedgerPostingAdapter(LedgerService ledger) {
    this.ledger = ledger;
  }

  @Override
  public void onInvoiceIssued(String invoiceId, String propertyId, String memberProfileId,
      int totalMinor, int discountMinor, int taxMinor, List<InvoiceLine> items) {
    List<Postings.Item> aggregated = new ArrayList<>();
    for (InvoiceLine l : items) aggregated.add(new Postings.Item(l.kind(), l.amountMinor()));
    List<Line> lines = Postings.invoiceIssueLines(totalMinor, discountMinor, taxMinor, aggregated);
    ledger.post(new LedgerService.PostInput("Invoice issued", "invoice", invoiceId,
        propertyId, memberProfileId, null, null, lines));
  }

  @Override
  public void onInvoiceVoided(String invoiceId, String reason) {
    // Reverse the live issue + late-fee postings that make up the invoice.
    ledger.liveTransactions(List.of("invoice", "late_fee"), invoiceId)
        .forEach(t -> ledger.reverse(t.getId(), "Invoice voided: " + reason, "invoice_void", invoiceId, null));
  }

  @Override
  public void onCreditNoteIssued(String invoiceId, String propertyId, String memberProfileId,
      String noteCode, int amountMinor, String reason) {
    // DR revenue pro-rata of the invoice's live revenue lines, CR 1300.
    List<Line> revenue = ledger.liveRevenueLines(List.of("invoice", "late_fee"), invoiceId);
    List<Line> lines = Postings.creditNoteLines(revenue, amountMinor);
    ledger.post(new LedgerService.PostInput("Credit note " + noteCode + ": " + reason,
        "credit_note", invoiceId, propertyId, memberProfileId, null, null, lines));
  }

  @Override
  public void onPaymentConfirmed(String paymentId, String propertyId, String memberProfileId,
      String method, int amountMinor, String receiptCode) {
    List<Line> lines = List.of(
        Line.debit(ChartOfAccounts.settlementAccountCode(method), amountMinor, null),
        Line.credit(ChartOfAccounts.RENT_RECEIVABLE, amountMinor, "Receipt " + receiptCode));
    ledger.post(new LedgerService.PostInput("Payment confirmed — receipt " + receiptCode,
        "payment", paymentId, propertyId, memberProfileId, null, null, lines));
  }

  @Override
  public void onPaymentRefunded(String paymentId, String propertyId, String memberProfileId,
      String method, int amountMinor, String reason) {
    List<Line> lines = List.of(
        Line.debit(ChartOfAccounts.RENT_RECEIVABLE, amountMinor, "Refund: " + reason),
        Line.credit(ChartOfAccounts.settlementAccountCode(method), amountMinor, null));
    ledger.post(new LedgerService.PostInput("Payment refund: " + reason, "refund", paymentId,
        propertyId, memberProfileId, null, null, lines));
  }

  @Override
  public void onDepositBilled(String depositInvoiceId, String propertyId, String memberProfileId,
      int totalMinor) {
    // The deposit obligation: DR 1300 receivable / CR 2100 deposit liability.
    List<Line> lines = List.of(
        Line.debit(ChartOfAccounts.RENT_RECEIVABLE, totalMinor, null),
        Line.credit(ChartOfAccounts.DEPOSIT_LIABILITY, totalMinor, "Deposit billed"));
    ledger.post(new LedgerService.PostInput("Deposit billed", "deposit", depositInvoiceId,
        propertyId, memberProfileId, null, null, lines));
  }

  @Override
  public String onDepositDeducted(String depositId, String propertyId, String memberProfileId,
      int amountMinor, String reason) {
    // DR 2100 liability; CR 4900 recovered cost, or 1300 for unpaid_rent.
    String creditCode = "unpaid_rent".equals(reason)
        ? ChartOfAccounts.RENT_RECEIVABLE : ChartOfAccounts.OTHER_REVENUE;
    List<Line> lines = List.of(
        Line.debit(ChartOfAccounts.DEPOSIT_LIABILITY, amountMinor, null),
        Line.credit(creditCode, amountMinor, "Deposit deduction (" + reason + ")"));
    return ledger.post(new LedgerService.PostInput("Deposit deduction (" + reason + ")",
        "deposit_deduction", depositId, propertyId, memberProfileId, null, null, lines));
  }

  @Override
  public String onDepositRefunded(String depositId, String propertyId, String memberProfileId,
      int amountMinor, String method, String reason) {
    List<Line> lines = List.of(
        Line.debit(ChartOfAccounts.DEPOSIT_LIABILITY, amountMinor, "Deposit refund: " + reason),
        Line.credit(ChartOfAccounts.settlementAccountCode(method), amountMinor, null));
    return ledger.post(new LedgerService.PostInput("Deposit refund: " + reason,
        "deposit_refund", depositId, propertyId, memberProfileId, null, null, lines));
  }
}
