package com.rentmanager.ops.repository;

import com.rentmanager.ops.domain.Complaint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ComplaintRepository extends JpaRepository<Complaint, String> {
    List<Complaint> findByPropertyId(String propertyId);
    List<Complaint> findByMemberProfileId(String memberProfileId);
    Optional<Complaint> findByCode(String code);
}
