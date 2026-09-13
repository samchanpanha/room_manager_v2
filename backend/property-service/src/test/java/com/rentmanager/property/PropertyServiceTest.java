package com.rentmanager.property;

import com.rentmanager.property.domain.Property;
import com.rentmanager.property.dto.CreatePropertyRequest;
import com.rentmanager.property.dto.PropertyDto;
import com.rentmanager.property.kafka.PropertyOutboxService;
import com.rentmanager.property.repository.BuildingRepository;
import com.rentmanager.property.repository.FloorRepository;
import com.rentmanager.property.repository.PropertyRepository;
import com.rentmanager.property.repository.RoomRepository;
import com.rentmanager.property.service.PropertyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PropertyServiceTest {

    private PropertyRepository propertyRepository;
    private BuildingRepository buildingRepository;
    private FloorRepository floorRepository;
    private RoomRepository roomRepository;
    private PropertyOutboxService outboxService;
    private PropertyService propertyService;

    @BeforeEach
    void setUp() {
        propertyRepository = mock(PropertyRepository.class);
        buildingRepository = mock(BuildingRepository.class);
        floorRepository = mock(FloorRepository.class);
        roomRepository = mock(RoomRepository.class);
        outboxService = mock(PropertyOutboxService.class);
        when(buildingRepository.findByPropertyId(anyString())).thenReturn(java.util.List.of());
        propertyService = new PropertyService(
            propertyRepository, buildingRepository, floorRepository, roomRepository, outboxService
        );
    }

    @Test
    void createProperty_Success() {
        CreatePropertyRequest request = new CreatePropertyRequest(
            "PROP-001", "Sunrise Apartments", "123 Main St", 11.5, 104.9, 50
        );

        when(propertyRepository.findByCode("PROP-001")).thenReturn(Optional.empty());
        when(propertyRepository.save(any(Property.class))).thenAnswer(invocation -> invocation.getArgument(0));

        PropertyDto dto = propertyService.createProperty("TENANT_01", request);

        assertNotNull(dto);
        assertNotNull(dto.id());
        assertEquals("PROP-001", dto.code());
        assertEquals("Sunrise Apartments", dto.name());
        assertEquals("123 Main St", dto.address());
        assertEquals("active", dto.status());

        verify(outboxService, times(1)).publishEvent(
            eq("property.created"),
            anyString(),
            anyMap()
        );
    }

    @Test
    void createProperty_DuplicateCode_ThrowsException() {
        CreatePropertyRequest request = new CreatePropertyRequest(
            "PROP-001", "Sunrise Apartments", "123 Main St", null, null, null
        );

        when(propertyRepository.findByCode("PROP-001"))
            .thenReturn(Optional.of(new Property("p1", "TENANT_01", "PROP-001", "Existing", "Address")));

        IllegalArgumentException ex = assertThrows(
            IllegalArgumentException.class,
            () -> propertyService.createProperty("TENANT_01", request)
        );

        assertTrue(ex.getMessage().contains("already exists"));
        verify(propertyRepository, never()).save(any());
        verify(outboxService, never()).publishEvent(any(), any(), any());
    }
}
