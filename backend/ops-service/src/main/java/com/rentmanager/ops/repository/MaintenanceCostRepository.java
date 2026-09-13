package com.rentmanager.ops.repository;

import com.rentmanager.ops.domain.MaintenanceCost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MaintenanceCostRepository extends JpaRepository<MaintenanceCost, String> {
    List<MaintenanceCost> findByTicketId(String ticketId);
}
