package com.rentmanager.staff.repository;

import com.rentmanager.staff.domain.AttendanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, String> {
    List<AttendanceRecord> findByPropertyId(String propertyId);
    Optional<AttendanceRecord> findByUserIdAndWorkDate(String userId, Instant workDate);
}
