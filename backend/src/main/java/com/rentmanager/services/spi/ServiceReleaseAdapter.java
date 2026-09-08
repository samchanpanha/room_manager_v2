package com.rentmanager.services.spi;

import com.rentmanager.leasing.spi.ServiceReleasePort;
import com.rentmanager.services.service.ServiceAppService;
import java.time.Instant;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/**
 * Services' implementation of the leasing {@link ServiceReleasePort} (M12):
 * when a lease ends, ends every active/suspended assignment — closing billing
 * windows and releasing parking/WiFi. Registering this {@code @Primary} bean
 * replaces leasing's no-op default (dependency inversion — leasing never imports
 * services).
 */
@Component
@Primary
public class ServiceReleaseAdapter implements ServiceReleasePort {

  private final ServiceAppService services;

  public ServiceReleaseAdapter(ServiceAppService services) {
    this.services = services;
  }

  @Override
  public int endAssignmentsForLease(String leaseId, Instant at) {
    return services.endAssignmentsForLease(leaseId, at);
  }
}
