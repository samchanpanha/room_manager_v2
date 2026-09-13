package com.rentmanager.property.repository;

import com.rentmanager.property.domain.Meter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MeterRepository extends JpaRepository<Meter, String> {
    List<Meter> findByRoomId(String roomId);
    Optional<Meter> findByCode(String code);
}
