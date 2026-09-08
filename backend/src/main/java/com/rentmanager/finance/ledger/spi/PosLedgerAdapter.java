package com.rentmanager.finance.ledger.spi;

import com.rentmanager.finance.ledger.service.ChartOfAccounts;
import com.rentmanager.finance.ledger.service.LedgerService;
import com.rentmanager.finance.ledger.service.Postings.Line;
import com.rentmanager.inventory.spi.PosLedgerPort;
import java.util.List;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/**
 * Finance's implementation of the inventory {@link PosLedgerPort} (INTENT.md
 * M08/M14): an immediately-settled POS sale posts DR the drawer account
 * (1100 cash / 1200 bank, by method) / CR 4900 other revenue for the net
 * (post-discount) amount. Registering this {@code @Primary} bean replaces
 * inventory's no-op default. Dependency inversion — inventory never imports
 * finance.
 */
@Component
@Primary
public class PosLedgerAdapter implements PosLedgerPort {

  private final LedgerService ledger;

  public PosLedgerAdapter(LedgerService ledger) {
    this.ledger = ledger;
  }

  @Override
  public void onPosSaleSettled(String saleId, String propertyId, String method, int netMinor,
      int discountMinor, String memo, String actorId) {
    if (netMinor <= 0) return; // nothing to post for a fully-discounted sale
    List<Line> lines = List.of(
        Line.debit(ChartOfAccounts.settlementAccountCode(method), netMinor, null),
        Line.credit(ChartOfAccounts.OTHER_REVENUE, netMinor, null));
    ledger.post(new LedgerService.PostInput(memo, "pos_sale", saleId,
        propertyId, null, actorId, null, lines));
  }
}
