package com.rentmanager.commerce.repository;

import com.rentmanager.commerce.domain.PosSaleItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PosSaleItemRepository extends JpaRepository<PosSaleItem, String> {
    List<PosSaleItem> findBySaleId(String saleId);
}
