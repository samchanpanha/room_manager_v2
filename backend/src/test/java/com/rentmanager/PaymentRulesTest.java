package com.rentmanager;

import static org.assertj.core.api.Assertions.assertThat;

import com.rentmanager.billing.service.PaymentAllocator;
import com.rentmanager.billing.service.PaymentAllocator.Allocation;
import com.rentmanager.billing.service.PaymentAllocator.OpenInvoice;
import com.rentmanager.billing.service.PaymentAllocator.Result;
import com.rentmanager.billing.service.PaymentMachine;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Ports the payment state-machine and allocation tests from
 * {@code src/lib/payments/*} so both stacks enforce identical rules (M09).
 */
class PaymentRulesTest {

  @Test
  void stateMachineAllowsAndBlocksTransitions() {
    assertThat(PaymentMachine.canTransition("pending", "confirmed")).isTrue();
    assertThat(PaymentMachine.canTransition("pending", "failed")).isTrue();
    assertThat(PaymentMachine.canTransition("confirmed", "refunded")).isTrue();
    assertThat(PaymentMachine.canTransition("confirmed", "failed")).isFalse();
    assertThat(PaymentMachine.canTransition("refunded", "confirmed")).isFalse();
    assertThat(PaymentMachine.canTransition("failed", "confirmed")).isFalse();
  }

  @Test
  void settlementAccountsSplitCashVsGateway() {
    assertThat(PaymentMachine.settlementAccountCode("cash")).isEqualTo("1100");
    assertThat(PaymentMachine.settlementAccountCode("cheque")).isEqualTo("1100");
    assertThat(PaymentMachine.settlementAccountCode("qr")).isEqualTo("1200");
    assertThat(PaymentMachine.settlementAccountCode("card")).isEqualTo("1200");
    assertThat(PaymentMachine.settlementAccountCode("bank_transfer")).isEqualTo("1200");
  }

  @Test
  void allocatesOldestFirstAndCapsPerInvoice() {
    Instant t0 = Instant.parse("2026-01-01T00:00:00Z");
    Instant t1 = Instant.parse("2026-02-01T00:00:00Z");
    Instant t2 = Instant.parse("2026-03-01T00:00:00Z");
    List<OpenInvoice> open = List.of(
        new OpenInvoice("c", 5000, t2, t2),
        new OpenInvoice("a", 3000, t0, t0),
        new OpenInvoice("b", 4000, t1, t1));

    Result r = PaymentAllocator.allocateOldestFirst(open, 8500);
    // 3000 → a (oldest), 4000 → b, 1500 → c; remainder 0.
    assertThat(r.allocations()).extracting(Allocation::invoiceId).containsExactly("a", "b", "c");
    assertThat(r.allocations()).extracting(Allocation::amountMinor).containsExactly(3000, 4000, 1500);
    assertThat(r.remainderMinor()).isZero();
  }

  @Test
  void overpaymentLeavesRemainderAsCredit() {
    Instant t0 = Instant.parse("2026-01-01T00:00:00Z");
    List<OpenInvoice> open = List.of(new OpenInvoice("a", 3000, t0, t0));
    Result r = PaymentAllocator.allocateOldestFirst(open, 5000);
    assertThat(r.allocations()).hasSize(1);
    assertThat(r.allocations().get(0).amountMinor()).isEqualTo(3000);
    assertThat(r.remainderMinor()).isEqualTo(2000);
  }

  @Test
  void noOpenInvoicesMeansFullCredit() {
    Result r = PaymentAllocator.allocateOldestFirst(List.of(), 5000);
    assertThat(r.allocations()).isEmpty();
    assertThat(r.remainderMinor()).isEqualTo(5000);
  }

  @Test
  void explicitAllocationValidation() {
    assertThat(PaymentAllocator.validateExplicit(
        List.of(new Allocation("a", 1000), new Allocation("b", 2000)), 3000)).isNull();
    assertThat(PaymentAllocator.validateExplicit(
        List.of(new Allocation("a", 1000), new Allocation("b", 2500)), 3000))
        .contains("exceed");
    assertThat(PaymentAllocator.validateExplicit(
        List.of(new Allocation("a", 1000), new Allocation("a", 500)), 3000))
        .contains("Duplicate");
    assertThat(PaymentAllocator.validateExplicit(
        List.of(new Allocation("a", 0)), 3000)).contains("positive");
  }
}
