package com.rentmanager.property.repository;

import com.rentmanager.property.domain.MeterReading;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MeterReadingRepository extends JpaRepository<MeterReading, String> {
    List<MeterReading> findByMeterIdOrderByReadAtDesc(String meterId);
}
