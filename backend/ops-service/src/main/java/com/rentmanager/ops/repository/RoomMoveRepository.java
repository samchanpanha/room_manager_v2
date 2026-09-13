package com.rentmanager.ops.repository;

import com.rentmanager.ops.domain.RoomMove;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomMoveRepository extends JpaRepository<RoomMove, String> {
    List<RoomMove> findByMemberProfileId(String memberProfileId);
    List<RoomMove> findByStatus(String status);
    Optional<RoomMove> findByCode(String code);
}
