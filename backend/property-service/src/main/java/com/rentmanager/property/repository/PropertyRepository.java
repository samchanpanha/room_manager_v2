package com.rentmanager.property.repository;

import com.rentmanager.property.domain.Property;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PropertyRepository extends JpaRepository<Property, String> {
    List<Property> findByTenantId(String tenantId);
    Optional<Property> findByCode(String code);
    Optional<Property> findByIdAndTenantId(String id, String tenantId);
}
