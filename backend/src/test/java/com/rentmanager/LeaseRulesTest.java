package com.rentmanager;

import static org.assertj.core.api.Assertions.assertThat;

import com.rentmanager.leasing.service.BillingDates;
import com.rentmanager.leasing.service.LeaseMachine;
import com.rentmanager.leasing.service.Occupancy;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Ports the lease state-machine, occupancy and billing-date tests from the TS
 * suite so the two stacks enforce identical rules (INTENT.md M05).
 */
class LeaseRulesTest {

  @Test
  void stateMachineAllowsAndBlocksTransitions() {
    assertThat(LeaseMachine.canTransition("draft", "active")).isTrue();
    assertThat(LeaseMachine.canTransition("active", "notice")).isTrue();
    assertThat(LeaseMachine.canTransition("active", "completed")).isTrue();
    assertThat(LeaseMachine.canTransition("notice", "terminated")).isTrue();
    assertThat(LeaseMachine.canTransition("draft", "completed")).isFalse();
    assertThat(LeaseMachine.canTransition("terminated", "active")).isFalse();
    assertThat(LeaseMachine.canTransition("completed", "notice")).isFalse();
  }

  @Test
  void bedCannotBeDoubleBooked() {
    var active = List.of(new Occupancy.LeaseRef("l1", "bedA"));
    var check = Occupancy.checkPlacement("occupied", 2, active, "bedA", List.of("bedA", "bedB"));
    assertThat(check.ok()).isFalse();
    assertThat(check.code()).isEqualTo("BED_TAKEN");
  }

  @Test
  void secondBedInCapacityTwoRoomIsAllowed() {
    var active = List.of(new Occupancy.LeaseRef("l1", "bedA"));
    var check = Occupancy.checkPlacement("occupied", 2, active, "bedB", List.of("bedA", "bedB"));
    assertThat(check.ok()).isTrue();
  }

  @Test
  void wholeRoomLeaseRequiresEmptyRoom() {
    var active = List.of(new Occupancy.LeaseRef("l1", "bedA"));
    var check = Occupancy.checkPlacement("occupied", 2, active, null, List.of("bedA", "bedB"));
    assertThat(check.ok()).isFalse();
    assertThat(check.code()).isEqualTo("WHOLE_ROOM_CONFLICT");
  }

  @Test
  void capacityIsEnforced() {
    var active = List.of(new Occupancy.LeaseRef("l1", "bedA"));
    var check = Occupancy.checkPlacement("occupied", 1, active, "bedB", List.of("bedA", "bedB"));
    assertThat(check.ok()).isFalse();
    assertThat(check.code()).isEqualTo("ROOM_FULL");
  }

  @Test
  void cleaningRoomIsNotMoveInReady() {
    assertThat(Occupancy.isMoveInReady("cleaning")).isFalse();
    assertThat(Occupancy.isMoveInReady("maintenance")).isFalse();
    assertThat(Occupancy.isMoveInReady("vacant")).isTrue();
  }

  @Test
  void nextBillingDateRollsWhenStartPastCycleDay() {
    // Start 2026-01-15, cycle day 1 → next billing is 2026-02-01.
    Instant start = Instant.parse("2026-01-15T00:00:00Z");
    Instant next = BillingDates.computeNextBillingDate(start, 1);
    assertThat(next).isEqualTo(Instant.parse("2026-02-01T00:00:00Z"));
  }

  @Test
  void nextBillingDateSameMonthWhenStartBeforeCycleDay() {
    // Start 2026-01-05, cycle day 20 → next billing is 2026-01-20.
    Instant start = Instant.parse("2026-01-05T00:00:00Z");
    Instant next = BillingDates.computeNextBillingDate(start, 20);
    assertThat(next).isEqualTo(Instant.parse("2026-01-20T00:00:00Z"));
  }
}
