package com.rentmanager.ops.repository;

import com.rentmanager.ops.domain.MaintenanceTicket;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MaintenanceTicketRepository extends JpaRepository<MaintenanceTicket, String> {
    List<MaintenanceTicket> findByPropertyId(String propertyId);
    List<MaintenanceTicket> findByStatus(String status);
    Optional<MaintenanceTicket> findByCode(String code);
}
