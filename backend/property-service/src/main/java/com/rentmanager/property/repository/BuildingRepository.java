package com.rentmanager.property.repository;

import com.rentmanager.property.domain.Building;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BuildingRepository extends JpaRepository<Building, String> {
    List<Building> findByPropertyId(String propertyId);
}
