package com.rentmanager.billing.spi;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Default no-op used while the finance/deposits module (M10) is not registered.
 * Replaced automatically once finance provides a {@link DepositAdvancePort} bean.
 */
@Configuration
public class NoopDepositAdvance {

  @Bean
  @ConditionalOnMissingBean(DepositAdvancePort.class)
  public DepositAdvancePort noopDepositAdvancePort() {
    return invoiceId -> { };
  }
}
