package com.rentmanager.billing.spi;

import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Default no-op utility billing used while the utilities module (M11) registers
 * no adapter. Replaced automatically once a real {@link UtilityBillingPort} bean
 * is present, at which point generation folds pending utility charges into
 * invoices.
 */
@Configuration
public class NoopUtilityBilling {

  @Bean
  @ConditionalOnMissingBean(UtilityBillingPort.class)
  public UtilityBillingPort noopUtilityBillingPort() {
    return new UtilityBillingPort() {
      @Override public List<PendingCharge> pendingForLease(String leaseId) { return List.of(); }
      @Override public void markBilled(List<String> chargeIds, String invoiceId) {}
      @Override public void revertForInvoice(String invoiceId) {}
    };
  }
}
