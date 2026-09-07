package com.rentmanager;

import static org.assertj.core.api.Assertions.assertThat;

import com.rentmanager.billing.service.InvoiceMachine;
import org.junit.jupiter.api.Test;

/**
 * Ports the invoice state-machine tests from {@code src/lib/billing/machines.ts}
 * so both stacks enforce identical lifecycle rules (INTENT.md M07).
 */
class InvoiceRulesTest {

  @Test
  void allowsForwardLifecycleTransitions() {
    assertThat(InvoiceMachine.canTransition("draft", "issued")).isTrue();
    assertThat(InvoiceMachine.canTransition("issued", "partial_paid")).isTrue();
    assertThat(InvoiceMachine.canTransition("issued", "paid")).isTrue();
    assertThat(InvoiceMachine.canTransition("issued", "overdue")).isTrue();
    assertThat(InvoiceMachine.canTransition("partial_paid", "paid")).isTrue();
    assertThat(InvoiceMachine.canTransition("overdue", "partial_paid")).isTrue();
  }

  @Test
  void anyLiveStateCanBeVoided() {
    assertThat(InvoiceMachine.canTransition("draft", "void")).isTrue();
    assertThat(InvoiceMachine.canTransition("issued", "void")).isTrue();
    assertThat(InvoiceMachine.canTransition("partial_paid", "void")).isTrue();
    assertThat(InvoiceMachine.canTransition("overdue", "void")).isTrue();
  }

  @Test
  void paidAndVoidAreTerminal() {
    assertThat(InvoiceMachine.canTransition("paid", "void")).isFalse();
    assertThat(InvoiceMachine.canTransition("paid", "overdue")).isFalse();
    assertThat(InvoiceMachine.canTransition("void", "issued")).isFalse();
    assertThat(InvoiceMachine.canTransition("void", "paid")).isFalse();
  }

  @Test
  void blocksIllegalJumps() {
    assertThat(InvoiceMachine.canTransition("draft", "paid")).isFalse();
    assertThat(InvoiceMachine.canTransition("draft", "partial_paid")).isFalse();
    assertThat(InvoiceMachine.canTransition("draft", "overdue")).isFalse();
  }

  @Test
  void recognisesItemKinds() {
    assertThat(InvoiceMachine.isItemKind("rent")).isTrue();
    assertThat(InvoiceMachine.isItemKind("deposit")).isTrue();
    assertThat(InvoiceMachine.isItemKind("late_fee")).isTrue();
    assertThat(InvoiceMachine.isItemKind("bogus")).isFalse();
  }

  @Test
  void statusListMatchesTheTsUnion() {
    assertThat(InvoiceMachine.STATUSES)
        .containsExactly("draft", "issued", "partial_paid", "paid", "overdue", "void");
  }
}
