package com.rentmanager.property.service;

import com.rentmanager.property.domain.Room;
import com.rentmanager.property.dto.CreateRoomRequest;
import com.rentmanager.property.dto.RoomDto;
import com.rentmanager.property.dto.UpdateRoomStatusRequest;
import com.rentmanager.property.kafka.PropertyOutboxService;
import com.rentmanager.property.repository.RoomRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class RoomService {

    private final RoomRepository roomRepository;
    private final PropertyOutboxService outboxService;

    public RoomService(RoomRepository roomRepository, PropertyOutboxService outboxService) {
        this.roomRepository = roomRepository;
        this.outboxService = outboxService;
    }

    @Transactional(readOnly = true)
    public List<RoomDto> getRoomsByFloor(String floorId) {
        return roomRepository.findByFloorId(floorId).stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional(readOnly = true)
    public RoomDto getRoomById(String id) {
        Room room = roomRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Room not found with id: " + id));
        return toDto(room);
    }

    @Transactional
    public RoomDto createRoom(CreateRoomRequest request) {
        if (roomRepository.findByFloorIdAndNumber(request.floorId(), request.number()).isPresent()) {
            throw new IllegalArgumentException("Room number " + request.number() + " already exists on floor " + request.floorId());
        }

        String id = "room_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String type = request.type() != null ? request.type() : "STANDARD";
        Room room = new Room(id, request.floorId(), request.number(), type, request.basePriceMinor(), request.capacity());
        room.setNotes(request.notes());

        Room saved = roomRepository.save(room);

        outboxService.publishEvent(
            "room.created",
            null,
            Map.of(
                "roomId", saved.getId(),
                "floorId", saved.getFloorId(),
                "number", saved.getNumber(),
                "type", saved.getType(),
                "basePriceMinor", saved.getBasePriceMinor()
            )
        );

        return toDto(saved);
    }

    @Transactional
    public RoomDto updateRoomStatus(String roomId, UpdateRoomStatusRequest request) {
        Room room = roomRepository.findById(roomId)
            .orElseThrow(() -> new IllegalArgumentException("Room not found with id: " + roomId));

        String oldStatus = room.getStatus();
        String newStatus = request.status();

        room.setStatus(newStatus);
        room.setUpdatedAt(Instant.now());
        Room saved = roomRepository.save(room);

        outboxService.publishEvent(
            "room.status_changed",
            null,
            Map.of(
                "roomId", saved.getId(),
                "number", saved.getNumber(),
                "oldStatus", oldStatus,
                "newStatus", newStatus,
                "reason", request.reason() != null ? request.reason() : ""
            )
        );

        return toDto(saved);
    }

    private RoomDto toDto(Room r) {
        return new RoomDto(
            r.getId(),
            r.getFloorId(),
            r.getNumber(),
            r.getType(),
            r.getStatus(),
            r.getBasePriceMinor(),
            r.getCapacity(),
            r.getNotes(),
            r.getCreatedAt(),
            r.getUpdatedAt()
        );
    }
}
