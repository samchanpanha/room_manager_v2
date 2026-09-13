package com.rentmanager.commerce.repository;

import com.rentmanager.commerce.domain.PosSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PosSessionRepository extends JpaRepository<PosSession, String> {
    List<PosSession> findByPropertyId(String propertyId);
    Optional<PosSession> findByPropertyIdAndStatus(String propertyId, String status);
}
