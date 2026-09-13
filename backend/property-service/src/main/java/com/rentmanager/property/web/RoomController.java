package com.rentmanager.property.web;

import com.rentmanager.property.dto.CreateRoomRequest;
import com.rentmanager.property.dto.RoomDto;
import com.rentmanager.property.dto.UpdateRoomStatusRequest;
import com.rentmanager.property.service.RoomService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/rooms")
public class RoomController {

    private final RoomService roomService;

    public RoomController(RoomService roomService) {
        this.roomService = roomService;
    }

    @GetMapping
    public ResponseEntity<List<RoomDto>> getRoomsByFloor(@RequestParam String floorId) {
        return ResponseEntity.ok(roomService.getRoomsByFloor(floorId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RoomDto> getRoomById(@PathVariable String id) {
        return ResponseEntity.ok(roomService.getRoomById(id));
    }

    @PostMapping
    public ResponseEntity<RoomDto> createRoom(@Valid @RequestBody CreateRoomRequest request) {
        RoomDto created = roomService.createRoom(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<RoomDto> updateRoomStatus(
            @PathVariable String id,
            @Valid @RequestBody UpdateRoomStatusRequest request) {
        return ResponseEntity.ok(roomService.updateRoomStatus(id, request));
    }
}
