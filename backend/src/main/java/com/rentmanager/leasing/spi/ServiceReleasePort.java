package com.rentmanager.leasing.spi;

/**
 * SPI seam to the services module (INTENT.md M12). When a lease ends, leasing
 * calls this so every active/suspended service assignment is ended — closing its
 * billing window and releasing its parking slot / WiFi account. The services
 * module registers the real bean (dependency inversion — leasing never imports
 * services); until then {@link NoopServiceRelease} is active and lease end
 * simply notes that service release is deferred.
 */
public interface ServiceReleasePort {

  /** End all of a lease's assignments at {@code atIso}; returns how many ended. */
  int endAssignmentsForLease(String leaseId, java.time.Instant at);
}
