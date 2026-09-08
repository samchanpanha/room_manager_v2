package com.rentmanager;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.rentmanager.services.domain.ServiceUsage;
import com.rentmanager.services.service.ServiceRules;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/**
 * Ports the M12 services pure-rule expectations from {@code tests/services-*.test.ts}:
 * pricing-model + code validation, per-use quantity math, and the one-time line
 * amount (round(unitPrice × qty / 1000)). Pure — no Spring context needed.
 */
class ServiceRulesTest {

  @Test
  void validatesPricingModels() {
    assertThat(ServiceRules.isPricingModel("fixed_monthly")).isTrue();
    assertThat(ServiceRules.isPricingModel("per_use")).isTrue();
    assertThat(ServiceRules.isPricingModel("metered")).isTrue();
    assertThat(ServiceRules.isPricingModel("weekly")).isFalse();
  }

  @Test
  void validatesCatalogCodeShape() {
    assertThat(ServiceRules.isValidCode("WIFI")).isTrue();
    assertThat(ServiceRules.isValidCode("PARK-A")).isTrue();
    assertThat(ServiceRules.isValidCode("a")).isFalse();      // too short + lowercase
    assertThat(ServiceRules.isValidCode("has space")).isFalse();
    assertThat(ServiceRules.isValidCode("THIS-CODE-IS-WAY-TOO-LONG")).isFalse();
  }

  @Test
  void parsesQuantityIntoMilli() {
    assertThat(ServiceRules.toMilli("2.5")).isEqualTo(2500);
    assertThat(ServiceRules.toMilli("1")).isEqualTo(1000);
    assertThat(ServiceRules.toMilli("0.001")).isEqualTo(1);
    assertThatThrownBy(() -> ServiceRules.toMilli("-1")).isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> ServiceRules.toMilli("1.2345")).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void formatsMilliWithoutTrailingZeros() {
    assertThat(ServiceRules.formatMilli(2500)).isEqualTo("2.5");
    assertThat(ServiceRules.formatMilli(1000)).isEqualTo("1");
  }

  @Test
  void usageAmountIsRoundedUnitPriceTimesQty() {
    // 2.5 kg × 2.00/kg (200 minor) = 500 minor (tests/services-service.test.ts).
    ServiceUsage u = new ServiceUsage("svc", "lease", 2500, "kg", 200,
        Instant.parse("2026-08-25T12:00:00Z"), null, "actor", "DEFAULT");
    assertThat(u.amountMinor()).isEqualTo(500);

    // 1.333 units × 0.35 (35 minor) = round(46.655) = 47.
    ServiceUsage v = new ServiceUsage("svc", "lease", 1333, "unit", 35,
        Instant.parse("2026-08-25T12:00:00Z"), null, "actor", "DEFAULT");
    assertThat(v.amountMinor()).isEqualTo(47);
  }
}
