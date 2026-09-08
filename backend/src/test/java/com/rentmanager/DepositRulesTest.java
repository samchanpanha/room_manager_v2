package com.rentmanager;

import static org.assertj.core.api.Assertions.assertThat;

import com.rentmanager.finance.service.DepositMachine;
import org.junit.jupiter.api.Test;

/**
 * Ports the deposit state-machine + settlement math tests from
 * {@code src/lib/deposits/machines.ts} so both stacks agree (INTENT.md M10).
 */
class DepositRulesTest {

  @Test
  void forwardOnlyLifecycle() {
    assertThat(DepositMachine.canTransition("pending", "billed")).isTrue();
    assertThat(DepositMachine.canTransition("billed", "held")).isTrue();
    assertThat(DepositMachine.canTransition("held", "settled")).isTrue();
    assertThat(DepositMachine.canTransition("billed", "settled")).isFalse();
    assertThat(DepositMachine.canTransition("settled", "held")).isFalse();
    assertThat(DepositMachine.canTransition("held", "billed")).isFalse();
  }

  @Test
  void settlementOnlyInMoveOutWindow() {
    assertThat(DepositMachine.leaseAllowsSettlement("notice")).isTrue();
    assertThat(DepositMachine.leaseAllowsSettlement("completed")).isTrue();
    assertThat(DepositMachine.leaseAllowsSettlement("terminated")).isTrue();
    assertThat(DepositMachine.leaseAllowsSettlement("active")).isFalse();
    assertThat(DepositMachine.leaseAllowsSettlement("draft")).isFalse();
  }

  @Test
  void deductionCreditAccountByReason() {
    assertThat(DepositMachine.deductionCreditAccount("unpaid_rent")).isEqualTo("1300");
    assertThat(DepositMachine.deductionCreditAccount("damage")).isEqualTo("4900");
    assertThat(DepositMachine.deductionCreditAccount("cleaning")).isEqualTo("4900");
    assertThat(DepositMachine.deductionCreditAccount("other")).isEqualTo("4900");
  }

  @Test
  void installmentSplitAbsorbsRemainderInLast() {
    assertThat(DepositMachine.installmentSplit(10000, 1)).containsExactly(10000);
    assertThat(DepositMachine.installmentSplit(10000, 4)).containsExactly(2500, 2500, 2500, 2500);
    // 10001 / 3 = 3333 base, last absorbs +2 → sums to 10001.
    int[] three = DepositMachine.installmentSplit(10001, 3);
    assertThat(three).containsExactly(3333, 3333, 3335);
    assertThat(three[0] + three[1] + three[2]).isEqualTo(10001);
  }

  @Test
  void installmentSplitRejectsBadInput() {
    org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,
        () -> DepositMachine.installmentSplit(0, 3));
    org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,
        () -> DepositMachine.installmentSplit(10000, 0));
    org.junit.jupiter.api.Assertions.assertThrows(IllegalArgumentException.class,
        () -> DepositMachine.installmentSplit(10000, 13));
  }
}
