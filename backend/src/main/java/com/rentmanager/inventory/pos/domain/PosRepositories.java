package com.rentmanager.inventory.pos.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Spring Data repositories for the M14 POS sub-package. */
public final class PosRepositories {

  private PosRepositories() {}

  public interface Products extends JpaRepository<PosProduct, String> {
    // Catalog is global (name/barcode unique) — no tenant column, like Supplier.
    List<PosProduct> findAllByOrderByNameAsc();
    Optional<PosProduct> findByBarcode(String barcode);

    @Query("select p from PosProduct p where p.id in :ids and p.active = true")
    List<PosProduct> findActiveByIds(@Param("ids") List<String> ids);
  }

  public interface Sessions extends JpaRepository<PosSession, String> {
    Optional<PosSession> findByIdAndTenantId(String id, String tenantId);
    Optional<PosSession> findFirstByPropertyIdAndStatusAndTenantId(String propertyId, String status, String tenantId);
    List<PosSession> findTop20ByTenantIdOrderByOpenedAtDesc(String tenantId);
    List<PosSession> findByPropertyIdInAndTenantIdOrderByOpenedAtDesc(List<String> propertyIds, String tenantId);
  }

  public interface Sales extends JpaRepository<PosSale, String> {
    Optional<PosSale> findByIdAndTenantId(String id, String tenantId);
    List<PosSale> findBySessionIdAndTenantIdOrderByCreatedAtDesc(String sessionId, String tenantId);
    List<PosSale> findBySessionIdAndTenantId(String sessionId, String tenantId);
    List<PosSale> findTop100ByTenantIdOrderByCreatedAtDesc(String tenantId);
    List<PosSale> findByPropertyIdInAndTenantIdOrderByCreatedAtDesc(List<String> propertyIds, String tenantId);

    @Query("""
        select coalesce(sum(s.totalMinor - s.discountMinor), 0) from PosSale s
        where s.sessionId = :sessionId and s.method = 'cash' and s.tenantId = :tenantId
        """)
    int netCashForSession(@Param("sessionId") String sessionId, @Param("tenantId") String tenantId);

    long countBySessionIdAndTenantId(String sessionId, String tenantId);
  }
}
