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
      @Override public void onPaymentConfirmed(String i, String p, String m, String me, int a, String rc) {}
      @Override public void onPaymentRefunded(String i, String p, String m, String me, int a, String r) {}
      @Override public void onDepositBilled(String i, String p, String m, int t) {}
      @Override public String onDepositDeducted(String d, String p, String m, int a, String r) { return null; }
      @Override public String onDepositRefunded(String d, String p, String m, int a, String me, String r) { return null; }
    };
  }
}
