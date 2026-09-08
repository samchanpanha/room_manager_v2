package com.rentmanager.inventory.spi;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Default no-op {@link PosLedgerPort} used until finance registers the real
 * adapter. Keeps M14 POS sales working (sale + stock movements still commit)
 * without a ledger posting while the accounting module is being wired.
 */
@Configuration
public class NoopPosLedger {

  @Bean
  @ConditionalOnMissingBean(PosLedgerPort.class)
  public PosLedgerPort noopPosLedgerPort() {
    return (saleId, propertyId, method, netMinor, discountMinor, memo, actorId) -> { };
  }
}
