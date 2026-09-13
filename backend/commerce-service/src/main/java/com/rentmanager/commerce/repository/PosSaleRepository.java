package com.rentmanager.commerce.repository;

import com.rentmanager.commerce.domain.PosSale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PosSaleRepository extends JpaRepository<PosSale, String> {
    List<PosSale> findBySessionId(String sessionId);
    List<PosSale> findByPropertyId(String propertyId);
}
