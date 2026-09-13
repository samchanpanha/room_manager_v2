package com.rentmanager.ops.repository;

import com.rentmanager.ops.domain.InspectionFinding;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InspectionFindingRepository extends JpaRepository<InspectionFinding, String> {
    List<InspectionFinding> findByInspectionId(String inspectionId);
}
