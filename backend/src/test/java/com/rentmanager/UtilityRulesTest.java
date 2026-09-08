package com.rentmanager;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.rentmanager.utilities.service.UtilityRules;
import com.rentmanager.utilities.service.UtilityRules.Spike;
import com.rentmanager.utilities.service.UtilityRules.TariffTier;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Ports the M11 utilities pure-rule tests from {@code tests/utilities.test.ts}
 * so both stacks parse readings, price tiers, estimate and detect spikes
 * identically (INTENT.md M11). Pure math — no Spring context needed.
 */
class UtilityRulesTest {

  // ---- reading math (milli-units) ----------------------------------------

  @Test
  void parsesDisplayUnitsIntoMilli() {
    assertThat(UtilityRules.toMilli("241.5")).isEqualTo(241_500);
    assertThat(UtilityRules.toMilli("0.001")).isEqualTo(1);
    assertThat(UtilityRules.toMilli("1200")).isEqualTo(1_200_000);
    assertThatThrownBy(() -> UtilityRules.toMilli("-5")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> UtilityRules.toMilli("1.2345")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> UtilityRules.toMilli("abc")).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void formatsBackWithoutTrailingZeros() {
    assertThat(UtilityRules.formatMilli(241_500)).isEqualTo("241.5");
    assertThat(UtilityRules.formatMilli(1_200_000)).isEqualTo("1200");
    assertThat(UtilityRules.formatMilli(1)).isEqualTo("0.001");
  }

  // ---- tiered pricing ----------------------------------------------------

  @Test
  void pricesFlatRatesHalfUp() {
    assertThat(UtilityRules.tieredChargeMinor(100_500, 35, null)).isEqualTo(3518); // 100.5 × 0.35
    assertThat(UtilityRules.tieredChargeMinor(0, 35, null)).isEqualTo(0);
  }

  @Test
  void pricesProgressiveTiersPerBracket() {
    List<TariffTier> tiers = List.of(
        new TariffTier(100_000, 30), // first 100 units at 0.30
        new TariffTier(null, 50));   // beyond at 0.50
    assertThat(UtilityRules.tieredChargeMinor(60_000, 0, tiers)).isEqualTo(1800);  // 60 × 30
    assertThat(UtilityRules.tieredChargeMinor(150_000, 0, tiers)).isEqualTo(5500); // 100×30 + 50×50
  }

  @Test
  void rejectsConsumptionNotCoveredByTiers() {
    List<TariffTier> tiers = List.of(new TariffTier(1000, 10));
    assertThatThrownBy(() -> UtilityRules.tieredChargeMinor(2000, 0, tiers))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("cover");
  }

  // ---- estimates ---------------------------------------------------------

  @Test
  void estimatesAverageOfLastThree() {
    assertThat(UtilityRules.estimateFromHistory(List.of(100_000, 110_000, 122_000)))
        .isEqualTo(110_667); // avg 110666.67, half-up
    assertThatThrownBy(() -> UtilityRules.estimateFromHistory(List.of(100_000, 110_000)))
        .isInstanceOf(IllegalArgumentException.class);
  }

  // ---- spike detection ---------------------------------------------------

  @Test
  void flagsConsumptionAboveTwiceAverage() {
    Spike s = UtilityRules.detectSpike(500_000, List.of(100_000, 110_000, 90_000));
    assertThat(s.anomaly()).isTrue();
    assertThat(s.averageMilli()).isEqualTo(100_000);
  }

  @Test
  void passesNormalConsumptionAndNeedsTwoHistoryPoints() {
    assertThat(UtilityRules.detectSpike(120_000, List.of(100_000, 110_000)).anomaly()).isFalse();
    assertThat(UtilityRules.detectSpike(999_999, List.of(100_000)).anomaly()).isFalse();
    assertThat(UtilityRules.detectSpike(999_999, List.of()).anomaly()).isFalse();
  }

  // ---- charge label ------------------------------------------------------

  @Test
  void buildsChargeLabelWithAnomalyMarker() {
    assertThat(UtilityRules.chargeLabel("elec", "M-1", 100_500, "kWh", false))
        .isEqualTo("Electricity — M-1 (100.5 kWh)");
    assertThat(UtilityRules.chargeLabel("water", "W-2", 5000, "m³", true))
        .isEqualTo("Water — W-2 (5 m³) ⚠");
  }
}
