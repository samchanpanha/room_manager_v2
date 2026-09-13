package com.rentmanager.property.repository;

import com.rentmanager.property.domain.Floor;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FloorRepository extends JpaRepository<Floor, String> {
    List<Floor> findByBuildingId(String buildingId);
}
