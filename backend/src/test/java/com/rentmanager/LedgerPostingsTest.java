package com.rentmanager;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.rentmanager.finance.ledger.service.ChartOfAccounts;
import com.rentmanager.finance.ledger.service.Postings;
import com.rentmanager.finance.ledger.service.Postings.Item;
import com.rentmanager.finance.ledger.service.Postings.Line;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Ports the ledger posting-builder tests from {@code src/lib/ledger/postings.ts}
 * so both stacks keep the double-entry balance invariant (INTENT.md M08).
 */
class LedgerPostingsTest {

  private static long sumDebit(List<Line> lines) { return lines.stream().mapToLong(l -> l.debit).sum(); }
  private static long sumCredit(List<Line> lines) { return lines.stream().mapToLong(l -> l.credit).sum(); }

  @Test
  void proportionalAllocationSumsToTotalExactly() {
    int[] shares = Postings.allocateProportional(10000, new int[] {1, 1, 1});
    assertThat(shares[0] + shares[1] + shares[2]).isEqualTo(10000);
    // Residual goes to the largest weight first (ties by index) → first bucket.
    assertThat(shares).containsExactly(3334, 3333, 3333);
  }

  @Test
  void allocationHandlesZeroWeights() {
    assertThat(Postings.allocateProportional(500, new int[] {0, 0})).containsExactly(0, 0);
    assertThat(Postings.allocateProportional(0, new int[] {5, 5})).containsExactly(0, 0);
  }

  @Test
  void invoiceIssueSplitsRevenueByKindAndBalances() {
    // rent 8000 + service 2000, no discount, tax 500 → total 10500.
    List<Line> lines = Postings.invoiceIssueLines(10500, 0, 500,
        List.of(new Item("rent", 8000), new Item("service", 2000)));
    Postings.assertBalanced(lines);
    assertThat(sumDebit(lines)).isEqualTo(10500);
    assertThat(sumCredit(lines)).isEqualTo(10500);
    assertThat(lines.get(0).code).isEqualTo(ChartOfAccounts.RENT_RECEIVABLE);
    assertThat(lines.get(0).debit).isEqualTo(10500);
    assertThat(lines).anyMatch(l -> l.code.equals(ChartOfAccounts.RENT_REVENUE) && l.credit == 8000);
    assertThat(lines).anyMatch(l -> l.code.equals(ChartOfAccounts.SERVICE_REVENUE) && l.credit == 2000);
    assertThat(lines).anyMatch(l -> l.code.equals(ChartOfAccounts.TAX_PAYABLE) && l.credit == 500);
  }

  @Test
  void invoiceIssueProratesDiscountAcrossKinds() {
    // rent 6000 + service 4000, discount 1000 → nets 600/400 off, total 9000.
    List<Line> lines = Postings.invoiceIssueLines(9000, 1000, 0,
        List.of(new Item("rent", 6000), new Item("service", 4000)));
    Postings.assertBalanced(lines);
    assertThat(sumCredit(lines)).isEqualTo(9000);
    assertThat(lines).anyMatch(l -> l.code.equals(ChartOfAccounts.RENT_REVENUE) && l.credit == 5400);
    assertThat(lines).anyMatch(l -> l.code.equals(ChartOfAccounts.SERVICE_REVENUE) && l.credit == 3600);
  }

  @Test
  void depositKindCreditsLiabilityNotRevenue() {
    List<Line> lines = Postings.invoiceIssueLines(5000, 0, 0, List.of(new Item("deposit", 5000)));
    assertThat(lines).anyMatch(l -> l.code.equals(ChartOfAccounts.DEPOSIT_LIABILITY) && l.credit == 5000);
  }

  @Test
  void creditNoteProratesAcrossOriginalRevenue() {
    List<Line> original = List.of(
        Line.credit(ChartOfAccounts.RENT_REVENUE, 8000, null),
        Line.credit(ChartOfAccounts.SERVICE_REVENUE, 2000, null));
    List<Line> lines = Postings.creditNoteLines(original, 1000);
    Postings.assertBalanced(lines);
    // CR 1300 receivable 1000; DR revenue 800/200.
    assertThat(lines).anyMatch(l -> l.code.equals(ChartOfAccounts.RENT_RECEIVABLE) && l.credit == 1000);
    assertThat(lines).anyMatch(l -> l.code.equals(ChartOfAccounts.RENT_REVENUE) && l.debit == 800);
    assertThat(lines).anyMatch(l -> l.code.equals(ChartOfAccounts.SERVICE_REVENUE) && l.debit == 200);
  }

  @Test
  void creditNoteFallsBackWhenNoOriginalPosting() {
    List<Line> lines = Postings.creditNoteLines(List.of(), 1500);
    Postings.assertBalanced(lines);
    assertThat(lines).anyMatch(l -> l.code.equals(ChartOfAccounts.OTHER_REVENUE) && l.debit == 1500);
    assertThat(lines).anyMatch(l -> l.code.equals(ChartOfAccounts.RENT_RECEIVABLE) && l.credit == 1500);
  }

  @Test
  void reversalMirrorsEveryLine() {
    List<Line> original = List.of(
        Line.debit(ChartOfAccounts.RENT_RECEIVABLE, 10000, null),
        Line.credit(ChartOfAccounts.RENT_REVENUE, 10000, null));
    List<Line> reversed = Postings.reversalLines(original);
    assertThat(reversed).anyMatch(l -> l.code.equals(ChartOfAccounts.RENT_RECEIVABLE) && l.credit == 10000);
    assertThat(reversed).anyMatch(l -> l.code.equals(ChartOfAccounts.RENT_REVENUE) && l.debit == 10000);
  }

  @Test
  void assertBalancedRejectsUnbalancedSets() {
    assertThatThrownBy(() -> Postings.assertBalanced(List.of(
        Line.debit(ChartOfAccounts.CASH, 100, null),
        Line.credit(ChartOfAccounts.BANK, 90, null))))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("UNBALANCED");
  }
}
