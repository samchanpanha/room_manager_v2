package com.rentmanager.commerce.repository;

import com.rentmanager.commerce.domain.StockItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StockItemRepository extends JpaRepository<StockItem, String> {
    List<StockItem> findByPropertyId(String propertyId);
    List<StockItem> findByPropertyIdAndIsActiveTrue(String propertyId);
}
