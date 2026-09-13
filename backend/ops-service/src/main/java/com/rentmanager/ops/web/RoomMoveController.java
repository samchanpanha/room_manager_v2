package com.rentmanager.ops.web;

import com.rentmanager.ops.dto.RequestRoomMoveRequest;
import com.rentmanager.ops.dto.RoomMoveDto;
import com.rentmanager.ops.service.RoomMoveService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/room-moves")
public class RoomMoveController {

    private final RoomMoveService roomMoveService;

    public RoomMoveController(RoomMoveService roomMoveService) {
        this.roomMoveService = roomMoveService;
    }

    @GetMapping
    public ResponseEntity<List<RoomMoveDto>> getRoomMovesByMember(@RequestParam String memberProfileId) {
        return ResponseEntity.ok(roomMoveService.getRoomMovesByMember(memberProfileId));
    }

    @PostMapping
    public ResponseEntity<RoomMoveDto> requestRoomMove(@Valid @RequestBody RequestRoomMoveRequest request) {
        RoomMoveDto created = roomMoveService.requestRoomMove(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<RoomMoveDto> approveRoomMove(@PathVariable String id) {
        return ResponseEntity.ok(roomMoveService.approveRoomMove(id));
    }
}
