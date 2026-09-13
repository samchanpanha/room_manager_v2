package com.rentmanager.property.repository;

import com.rentmanager.property.domain.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RoomRepository extends JpaRepository<Room, String> {
    List<Room> findByFloorId(String floorId);
    Optional<Room> findByFloorIdAndNumber(String floorId, String number);
    List<Room> findByStatus(String status);
}
