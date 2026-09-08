package com.rentmanager.utilities.domain;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** Spring Data repositories for the utilities module (INTENT.md M11). */
public final class UtilityRepositories {

  private UtilityRepositories() {}

  public interface Meters extends JpaRepository<Meter, String> {
    Optional<Meter> findByIdAndTenantId(String id, String tenantId);
    Optional<Meter> findByCodeAndTenantId(String code, String tenantId);
    boolean existsByCodeAndTenantId(String code, String tenantId);
    List<Meter> findByTenantIdOrderByCreatedAtDesc(String tenantId);
    List<Meter> findByRoomIdInAndTenantIdOrderByCreatedAtDesc(List<String> roomIds, String tenantId);
  }

  public interface Readings extends JpaRepository<MeterReading, String> {
    List<MeterReading> findByMeterIdAndTenantIdOrderByReadAtDesc(String meterId, String tenantId);
    Optional<MeterReading> findFirstByMeterIdAndTenantIdOrderByReadAtDesc(String meterId, String tenantId);
    boolean existsByMeterIdAndReadAtAndTenantId(String meterId, Instant readAt, String tenantId);
  }

  public interface Tariffs extends JpaRepository<Tariff, String> {
    List<Tariff> findByTenantIdOrderByEffectiveFromDesc(String tenantId);
    List<Tariff> findByUtilityTypeAndActiveTrueAndTenantId(String utilityType, String tenantId);
  }

  public interface Charges extends JpaRepository<UtilityCharge, String> {
    Optional<UtilityCharge> findByIdAndTenantId(String id, String tenantId);
    List<UtilityCharge> findByLeaseIdAndStatusAndTenantId(String leaseId, String status, String tenantId);
    List<UtilityCharge> findByInvoiceIdAndTenantId(String invoiceId, String tenantId);
    boolean existsByReadingIdAndTenantId(String readingId, String tenantId);
  }
}
