package com.rentmanager.ops.service;

import com.rentmanager.ops.domain.RoomMove;
import com.rentmanager.ops.dto.RequestRoomMoveRequest;
import com.rentmanager.ops.dto.RoomMoveDto;
import com.rentmanager.ops.kafka.OpsOutboxService;
import com.rentmanager.ops.repository.RoomMoveRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class RoomMoveService {

    private final RoomMoveRepository roomMoveRepository;
    private final OpsOutboxService outboxService;

    public RoomMoveService(RoomMoveRepository roomMoveRepository, OpsOutboxService outboxService) {
        this.roomMoveRepository = roomMoveRepository;
        this.outboxService = outboxService;
    }

    @Transactional(readOnly = true)
    public List<RoomMoveDto> getRoomMovesByMember(String memberProfileId) {
        return roomMoveRepository.findByMemberProfileId(memberProfileId).stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public RoomMoveDto requestRoomMove(RequestRoomMoveRequest request) {
        String id = "mov_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String code = "MOV-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        RoomMove move = new RoomMove(
            id, code, request.memberProfileId(), request.fromLeaseId(), request.toRoomId(), request.effectiveAt()
        );
        if (request.requestedByRole() != null) {
            move.setRequestedByRole(request.requestedByRole());
        }

        RoomMove saved = roomMoveRepository.save(move);

        outboxService.publishEvent(
            "room.move_requested",
            null,
            Map.of(
                "moveId", saved.getId(),
                "code", saved.getCode(),
                "memberProfileId", saved.getMemberProfileId(),
                "fromLeaseId", saved.getFromLeaseId(),
                "toRoomId", saved.getToRoomId()
            )
        );

        return toDto(saved);
    }

    @Transactional
    public RoomMoveDto approveRoomMove(String id) {
        RoomMove move = roomMoveRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Room move not found: " + id));

        move.setStatus("approved");
        move.setUpdatedAt(Instant.now());
        RoomMove saved = roomMoveRepository.save(move);

        outboxService.publishEvent(
            "room.move_approved",
            null,
            Map.of("moveId", saved.getId(), "code", saved.getCode())
        );

        return toDto(saved);
    }

    private RoomMoveDto toDto(RoomMove m) {
        return new RoomMoveDto(
            m.getId(),
            m.getCode(),
            m.getMemberProfileId(),
            m.getFromLeaseId(),
            m.getToRoomId(),
            m.getEffectiveAt(),
            m.getStatus(),
            m.getRequestedByRole(),
            m.getCreatedAt()
        );
    }
}
