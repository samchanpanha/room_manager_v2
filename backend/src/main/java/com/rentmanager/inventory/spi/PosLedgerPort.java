package com.rentmanager.inventory.spi;

/**
 * SPI seam to the accounting/ledger module (INTENT.md M08) for M14 POS sales
 * that settle immediately to the cash drawer. A {@code cash}/{@code qr}/
 * {@code card} sale posts DR the drawer account (1100 cash / 1200 bank) / CR
 * 4900 other revenue for the net (post-discount) amount — the {@code room_charge}
 * path instead issues an invoice via billing, which posts 1300/4900 itself.
 *
 * <p>Finance registers the real bean ({@code PosLedgerAdapter}); until it is on
 * the classpath {@link NoopPosLedger} is active and the posting is skipped (the
 * sale + stock movements still commit). Dependency inversion keeps inventory
 * free of any finance dependency.
 */
public interface PosLedgerPort {

  /**
   * Post an immediately-settled POS sale to the drawer chart.
   *
   * @param saleId    the {@code PosSale} id (posting ref)
   * @param method    {@code cash} | {@code qr} | {@code card}
   * @param netMinor  gross − discount (what actually hits the drawer)
   */
  void onPosSaleSettled(String saleId, String propertyId, String method, int netMinor,
      int discountMinor, String memo, String actorId);
}
