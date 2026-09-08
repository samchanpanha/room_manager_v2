package com.rentmanager.inventory.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Spring Data repositories for the inventory module (INTENT.md M15). */
public final class InventoryRepositories {

  private InventoryRepositories() {}

  public interface Items extends JpaRepository<StockItem, String> {
    Optional<StockItem> findByIdAndTenantId(String id, String tenantId);
    Optional<StockItem> findByNameAndPropertyIdAndTenantId(String name, String propertyId, String tenantId);
    List<StockItem> findByPropertyIdAndTenantIdOrderByNameAsc(String propertyId, String tenantId);
    List<StockItem> findByPropertyIdAndActiveTrueAndTenantIdOrderByNameAsc(String propertyId, String tenantId);
    long countByCategoryId(String categoryId);
  }

  public interface Categories extends JpaRepository<StockCategory, String> {
    // StockCategory has no tenantId column (shared/global categories exist, and
    // property-scoped ones are already isolated via their propertyId).

    // Categories predate the tenant discriminator in the Prisma schema (no
    // tenantId column), so visibility is by property scope only.
    @Query("""
        select c from StockCategory c
        where c.propertyId is null or c.propertyId in :scoped
        order by c.sortOrder asc, c.name asc
        """)
    List<StockCategory> findVisible(@Param("scoped") List<String> scoped);

    long countByParentId(String parentId);

    List<StockCategory> findByName(String name);
  }

  public interface Suppliers extends JpaRepository<Supplier, String> {
    Optional<Supplier> findByName(String name);
    List<Supplier> findAllByOrderByNameAsc();
  }

  public interface Movements extends JpaRepository<StockMovement, String> {
    // History for one item — movements where it is the source OR a transfer target.
    @Query("""
        select m from StockMovement m
        where m.tenantId = :tenantId
          and (m.stockItemId = :itemId or m.targetItemId = :itemId)
        order by m.createdAt desc
        """)
    List<StockMovement> historyFor(@Param("itemId") String itemId, @Param("tenantId") String tenantId);
  }

  public interface Stocktakes extends JpaRepository<Stocktake, String> {
    List<Stocktake> findByPropertyIdInAndTenantIdOrderByCreatedAtDesc(List<String> propertyIds, String tenantId);
  }

  public interface StocktakeLines extends JpaRepository<StocktakeLine, String> {
    List<StocktakeLine> findByStocktakeIdAndTenantId(String stocktakeId, String tenantId);
  }
}
