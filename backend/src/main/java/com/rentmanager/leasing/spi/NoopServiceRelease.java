package com.rentmanager.leasing.spi;

import java.time.Instant;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Default no-op service release used while the services module (M12) registers
 * no adapter. Replaced automatically once a real {@link ServiceReleasePort} bean
 * is present.
 */
@Configuration
public class NoopServiceRelease {

  @Bean
  @ConditionalOnMissingBean(ServiceReleasePort.class)
  public ServiceReleasePort noopServiceReleasePort() {
    return (leaseId, at) -> 0;
  }
}
