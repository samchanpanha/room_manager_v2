package com.rentmanager.property;

import com.rentmanager.property.domain.Room;
import com.rentmanager.property.dto.CreateRoomRequest;
import com.rentmanager.property.dto.RoomDto;
import com.rentmanager.property.dto.UpdateRoomStatusRequest;
import com.rentmanager.property.kafka.PropertyOutboxService;
import com.rentmanager.property.repository.RoomRepository;
import com.rentmanager.property.service.RoomService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RoomServiceTest {

    private RoomRepository roomRepository;
    private PropertyOutboxService outboxService;
    private RoomService roomService;

    @BeforeEach
    void setUp() {
        roomRepository = mock(RoomRepository.class);
        outboxService = mock(PropertyOutboxService.class);
        roomService = new RoomService(roomRepository, outboxService);
    }

    @Test
    void createRoom_Success() {
        CreateRoomRequest request = new CreateRoomRequest(
            "flr_01", "101", "STANDARD", 25000, 2, "Corner room"
        );

        when(roomRepository.findByFloorIdAndNumber("flr_01", "101")).thenReturn(Optional.empty());
        when(roomRepository.save(any(Room.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RoomDto dto = roomService.createRoom(request);

        assertNotNull(dto);
        assertEquals("101", dto.number());
        assertEquals("vacant", dto.status());
        assertEquals(25000, dto.basePriceMinor());

        verify(outboxService).publishEvent(eq("room.created"), any(), anyMap());
    }

    @Test
    void updateRoomStatus_EmitsOutboxEvent() {
        Room room = new Room("rm_01", "flr_01", "101", "STANDARD", 25000, 2);
        room.setStatus("vacant");

        when(roomRepository.findById("rm_01")).thenReturn(Optional.of(room));
        when(roomRepository.save(any(Room.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UpdateRoomStatusRequest request = new UpdateRoomStatusRequest("occupied", "Lease started");
        RoomDto updated = roomService.updateRoomStatus("rm_01", request);

        assertEquals("occupied", updated.status());
        verify(outboxService).publishEvent(eq("room.status_changed"), any(), anyMap());
    }
}
