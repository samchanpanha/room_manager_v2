package com.rentmanager.billing.spi;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Default no-op ledger posting used while the accounting module (M08) is not yet
 * ported. Replaced automatically once a real {@link LedgerPostingPort} bean is
 * registered by the ledger module.
 */
@Configuration
public class NoopLedgerPosting {

  @Bean
  @ConditionalOnMissingBean(LedgerPostingPort.class)
  public LedgerPostingPort noopLedgerPostingPort() {
    return new LedgerPostingPort() {
      @Override public void onInvoiceIssued(String i, String p, String m, int t) {}
      @Override public void onInvoiceVoided(String i, String r) {}
      @Override public void onCreditNoteIssued(String i, String c, int a, String r) {}
    };
  }
}
