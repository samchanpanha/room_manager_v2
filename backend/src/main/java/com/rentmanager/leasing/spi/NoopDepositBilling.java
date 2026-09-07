package com.rentmanager.leasing.spi;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Default no-op used while the finance/deposits module (M10) is not registered.
 * Replaced automatically once finance provides a {@link DepositBillingPort} bean.
 */
@Configuration
public class NoopDepositBilling {

  @Bean
  @ConditionalOnMissingBean(DepositBillingPort.class)
  public DepositBillingPort noopDepositBillingPort() {
    return leaseId -> null;
  }
}
