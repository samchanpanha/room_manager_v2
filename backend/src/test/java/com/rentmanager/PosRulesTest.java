package com.rentmanager;

import static org.assertj.core.api.Assertions.assertThat;

import com.rentmanager.inventory.pos.service.Ean13;
import com.rentmanager.inventory.pos.service.PosMath;
import org.junit.jupiter.api.Test;

/**
 * Ports the M14 POS math + EAN-13 helpers from {@code pos-service.tsx} /
 * {@code src/lib/barcode.ts} so both stacks compute the same line totals,
 * cash-drawer variance and barcode check digits.
 */
class PosRulesTest {

  @Test
  void lineTotalRoundsHalfUp() {
    // 3 units @ 1.50 = 4.50
    assertThat(PosMath.lineMinor(3_000, 150)).isEqualTo(450);
    // 1.5 units @ 1.00 = 1.50
    assertThat(PosMath.lineMinor(1_500, 100)).isEqualTo(150);
    // 0.333 units @ 1.00 = 0.333 → 0.33 (half-up)
    assertThat(PosMath.lineMinor(333, 100)).isEqualTo(33);
    // ties round up: 5 milli @ 100 = 0.5 → 1
    assertThat(PosMath.lineMinor(5, 100)).isEqualTo(1);
  }

  @Test
  void expectedCashAndVariance() {
    int expected = PosMath.expectedCashMinor(10_000, 25_000); // float 100 + 250 cash
    assertThat(expected).isEqualTo(35_000);
    assertThat(PosMath.varianceMinor(34_500, expected)).isEqualTo(-500); // 5.00 short
    assertThat(PosMath.varianceMinor(35_200, expected)).isEqualTo(200);  // 2.00 over
  }

  @Test
  void netAppliesDiscount() {
    assertThat(PosMath.netMinor(1_000, 150)).isEqualTo(850);
    assertThat(PosMath.netMinor(1_000, 0)).isEqualTo(1_000);
  }

  @Test
  void ean13ComputesCheckDigitFrom12() {
    // 590123412345 → check digit 7 (well-known EAN-13 example).
    assertThat(Ean13.checkDigit("590123412345")).isEqualTo(7);
    assertThat(Ean13.normalize("590123412345")).isEqualTo("5901234123457");
  }

  @Test
  void ean13AcceptsValid13AndRejectsBad() {
    assertThat(Ean13.normalize("5901234123457")).isEqualTo("5901234123457");
    assertThat(Ean13.normalize("5901234123450")).isNull(); // wrong check digit
    assertThat(Ean13.normalize("12345")).isNull();          // wrong length
    assertThat(Ean13.normalize(null)).isNull();
  }
}
