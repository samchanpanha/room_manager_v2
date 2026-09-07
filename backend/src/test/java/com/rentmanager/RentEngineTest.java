package com.rentmanager;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.rentmanager.billing.engine.Proration;
import com.rentmanager.billing.engine.RentEngine;
import com.rentmanager.billing.engine.RentEngine.CompositionInput;
import com.rentmanager.billing.engine.RentEngine.CompositionResult;
import com.rentmanager.billing.engine.RentEngine.LateFeeRule;
import com.rentmanager.billing.engine.RentEngine.LeaseInput;
import com.rentmanager.billing.engine.RentEngine.ServiceInput;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Ports the rent-engine tests from {@code src/lib/billing/{proration,engine}.ts}
 * so both stacks price invoices, late fees and dunning identically (INTENT.md
 * M06). Pure math — no Spring context needed.
 */
class RentEngineTest {

  private static Instant utc(String iso) { return Instant.parse(iso); }

  // ---- proration ---------------------------------------------------------

  @Test
  void fullCycleBillsTheFullAmount() {
    // Aug 1 → Sep 1 on a day-1 cycle is a full calendar month.
    Proration.Result r = Proration.prorate(30000, utc("2026-08-01T00:00:00Z"),
        utc("2026-09-01T00:00:00Z"), Proration.Basis.CALENDAR, 1);
    assertThat(r.isFullCycle()).isTrue();
    assertThat(r.amountMinor()).isEqualTo(30000);
  }

  @Test
  void midMonthMoveInProratesOnCalendarBasis() {
    // Aug 15 → Sep 1 = 17 days of a 31-day August.
    Proration.Result r = Proration.prorate(31000, utc("2026-08-15T00:00:00Z"),
        utc("2026-09-01T00:00:00Z"), Proration.Basis.CALENDAR, 1);
    assertThat(r.isFullCycle()).isFalse();
    assertThat(r.days()).isEqualTo(17);
    assertThat(r.factor()).isEqualTo("17/31");
    assertThat(r.amountMinor()).isEqualTo(Math.round(31000.0 * 17 / 31));
  }

  @Test
  void thirtyDayBasisUsesDenominator30() {
    Proration.Result r = Proration.prorate(30000, utc("2026-08-16T00:00:00Z"),
        utc("2026-09-01T00:00:00Z"), Proration.Basis.THIRTY_DAY, 1);
    assertThat(r.days()).isEqualTo(16);
    assertThat(r.amountMinor()).isEqualTo(16000); // 30000 * 16/30
  }

  @Test
  void nextCycleBoundaryClampsCycleDayTo28() {
    Instant next = Proration.nextCycleBoundary(utc("2026-02-10T00:00:00Z"), 31);
    assertThat(next).isEqualTo(utc("2026-02-28T00:00:00Z"));
  }

  // ---- composition -------------------------------------------------------

  private static CompositionResult compose(int rent, int taxBps, int discount,
      List<ServiceInput> services, List<RentEngine.OneTimeLine> oneTime) {
    Instant start = utc("2026-08-01T00:00:00Z");
    Instant end = utc("2026-09-01T00:00:00Z");
    return RentEngine.composeInvoice(new CompositionInput(
        new LeaseInput(rent, 1, Proration.Basis.CALENDAR, services),
        start, end, taxBps, discount, oneTime, RentEngine.formatPeriodLabel(start, end)));
  }

  @Test
  void composesRentServiceTaxWithTheInvariant() {
    CompositionResult r = compose(30000, 1000, 0,
        List.of(new ServiceInput("WiFi", 1000, "fixed_monthly", null, null)), List.of());
    assertThat(r.subtotalMinor()).isEqualTo(31000);
    assertThat(r.taxMinor()).isEqualTo(3100); // 10% of 31000
    assertThat(r.totalMinor()).isEqualTo(34100);
    assertThat(r.totalMinor()).isEqualTo(r.subtotalMinor() - r.discountMinor() + r.taxMinor());
    assertThat(r.lines()).anyMatch(l -> l.kind().equals("rent") && l.amountMinor() == 30000);
    assertThat(r.lines()).anyMatch(l -> l.kind().equals("service") && l.amountMinor() == 1000);
  }

  @Test
  void discountIsClampedToSubtotalAndTaxedOnNet() {
    CompositionResult r = compose(10000, 1000, 999999, List.of(), List.of());
    assertThat(r.discountMinor()).isEqualTo(10000); // clamped to subtotal
    assertThat(r.taxMinor()).isEqualTo(0);
    assertThat(r.totalMinor()).isEqualTo(0);
  }

  @Test
  void perUseServicesAreNotBilledAsFixedLines() {
    CompositionResult r = compose(10000, 0, 0,
        List.of(new ServiceInput("Laundry", 500, "per_use", null, null)), List.of());
    assertThat(r.lines()).noneMatch(l -> l.name().startsWith("Laundry"));
  }

  @Test
  void serviceWindowProratesMidCycleSuspension() {
    // WiFi suspended Aug 16 → billed for 15 of 31 days.
    CompositionResult r = compose(0, 0, 0,
        List.of(new ServiceInput("WiFi", 3100, "fixed_monthly", null, utc("2026-08-16T00:00:00Z"))),
        List.of());
    assertThat(r.lines()).anyMatch(l -> l.kind().equals("service")
        && l.amountMinor() == Math.round(3100.0 * 15 / 31));
  }

  @Test
  void oneTimeLinesRideTheInvoice() {
    CompositionResult r = compose(10000, 0, 0, List.of(),
        List.of(new RentEngine.OneTimeLine("utility", "Electricity 42 kWh", 4200)));
    assertThat(r.lines()).anyMatch(l -> l.kind().equals("utility") && l.amountMinor() == 4200);
    assertThat(r.subtotalMinor()).isEqualTo(14200);
  }

  @Test
  void rejectsInvertedPeriod() {
    assertThatThrownBy(() -> RentEngine.composeInvoice(new CompositionInput(
        new LeaseInput(1000, 1, Proration.Basis.CALENDAR, List.of()),
        utc("2026-09-01T00:00:00Z"), utc("2026-08-01T00:00:00Z"), 0, 0, List.of(), "x")))
        .isInstanceOf(IllegalArgumentException.class);
  }

  // ---- late fee + dunning ------------------------------------------------

  @Test
  void fixedLateFeeIsCappedByOutstanding() {
    LateFeeRule rule = new LateFeeRule("FIXED", 5000, null, null, 3);
    assertThat(RentEngine.evalLateFee(rule, 20000)).isEqualTo(5000);
    assertThat(RentEngine.evalLateFee(rule, 3000)).isEqualTo(3000); // capped by balance
    assertThat(RentEngine.evalLateFee(rule, 0)).isNull();
  }

  @Test
  void percentLateFeeAppliesCapAndFloorOfOne() {
    LateFeeRule capped = new LateFeeRule("PERCENT", null, 1000, 4000, 3); // 10%, cap 40.00
    assertThat(RentEngine.evalLateFee(capped, 100000)).isEqualTo(4000); // 10% = 10000, capped
    LateFeeRule tiny = new LateFeeRule("PERCENT", null, 1, null, 3);
    assertThat(RentEngine.evalLateFee(tiny, 100)).isEqualTo(1); // floor of 1 minor unit
  }

  @Test
  void dunningStageClimbsTheSchedule() {
    List<Integer> schedule = List.of(3, 7, 14);
    assertThat(RentEngine.dunningStage(2, schedule)).isEqualTo(0);
    assertThat(RentEngine.dunningStage(3, schedule)).isEqualTo(1);
    assertThat(RentEngine.dunningStage(10, schedule)).isEqualTo(2);
    assertThat(RentEngine.dunningStage(30, schedule)).isEqualTo(3);
  }
}
