package com.rentmanager.staff.repository;

import com.rentmanager.staff.domain.AttendanceException;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AttendanceExceptionRepository extends JpaRepository<AttendanceException, String> {
    List<AttendanceException> findByPropertyId(String propertyId);
    List<AttendanceException> findByStatus(String status);
}
