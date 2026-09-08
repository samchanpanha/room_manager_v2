package com.rentmanager.services.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Spring Data repositories for the services module (INTENT.md M12). */
public final class ServiceRepositories {

  private ServiceRepositories() {}

  public interface Catalog extends JpaRepository<ServiceCatalog, String> {
    Optional<ServiceCatalog> findByIdAndTenantId(String id, String tenantId);
    Optional<ServiceCatalog> findByCodeAndTenantId(String code, String tenantId);
    boolean existsByCodeAndTenantId(String code, String tenantId);
    List<ServiceCatalog> findByTenantIdOrderByCodeAsc(String tenantId);
  }

  public interface Assignments extends JpaRepository<ServiceAssignment, String> {
    Optional<ServiceAssignment> findByIdAndTenantId(String id, String tenantId);
    List<ServiceAssignment> findByTenantIdOrderByCreatedAtDesc(String tenantId);
    List<ServiceAssignment> findByLeaseIdAndStatusInAndTenantId(
        String leaseId, List<String> statuses, String tenantId);
  }

  public interface Usages extends JpaRepository<ServiceUsage, String> {
    Optional<ServiceUsage> findByIdAndTenantId(String id, String tenantId);
    List<ServiceUsage> findByTenantIdOrderByUsedAtDesc(String tenantId);
    List<ServiceUsage> findByLeaseIdAndStatusAndTenantId(String leaseId, String status, String tenantId);
    List<ServiceUsage> findByInvoiceIdAndTenantId(String invoiceId, String tenantId);
  }

  public interface ParkingSlots extends JpaRepository<ParkingSlot, String> {
    Optional<ParkingSlot> findByCodeAndTenantId(String code, String tenantId);
    List<ParkingSlot> findByTenantIdOrderByCodeAsc(String tenantId);
  }

  public interface WifiAccounts extends JpaRepository<WifiAccount, String> {
    Optional<WifiAccount> findBySsidAndTenantId(String ssid, String tenantId);
    List<WifiAccount> findByTenantIdOrderBySsidAsc(String tenantId);
  }
}
