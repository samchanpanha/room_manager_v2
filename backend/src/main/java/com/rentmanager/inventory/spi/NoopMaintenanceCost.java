package com.rentmanager.inventory.spi;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Default no-op maintenance-cost hook used while the maintenance module (M19) is
 * not yet ported. Replaced automatically once a real {@link MaintenanceCostPort}
 * bean is registered by the maintenance module.
 */
@Configuration
public class NoopMaintenanceCost {

  @Bean
  @ConditionalOnMissingBean(MaintenanceCostPort.class)
  public MaintenanceCostPort noopMaintenanceCostPort() {
    return (ticketId, stockItemId, label, amountMinor, qtyMilli, actorId) -> null;
  }
}
