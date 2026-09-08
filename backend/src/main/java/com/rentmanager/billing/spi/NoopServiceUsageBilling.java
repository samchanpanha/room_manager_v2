package com.rentmanager.billing.spi;

import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Default no-op per-use billing used while the services module (M12) registers
 * no adapter. Replaced automatically once a real {@link ServiceUsageBillingPort}
 * bean is present, at which point generation folds pending per-use entries into
 * invoices.
 */
@Configuration
public class NoopServiceUsageBilling {

  @Bean
  @ConditionalOnMissingBean(ServiceUsageBillingPort.class)
  public ServiceUsageBillingPort noopServiceUsageBillingPort() {
    return new ServiceUsageBillingPort() {
      @Override public List<PendingUsage> pendingForLease(String leaseId) { return List.of(); }
      @Override public void markBilled(List<String> usageIds, String invoiceId) {}
      @Override public void revertForInvoice(String invoiceId) {}
    };
  }
}
