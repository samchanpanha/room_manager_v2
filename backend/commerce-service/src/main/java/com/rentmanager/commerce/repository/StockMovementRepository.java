package com.rentmanager.commerce.repository;

import com.rentmanager.commerce.domain.StockMovement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StockMovementRepository extends JpaRepository<StockMovement, String> {
    List<StockMovement> findByStockItemId(String stockItemId);
}
