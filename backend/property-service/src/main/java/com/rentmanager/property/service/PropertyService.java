package com.rentmanager.property.service;

import com.rentmanager.property.domain.Building;
import com.rentmanager.property.domain.Floor;
import com.rentmanager.property.domain.Property;
import com.rentmanager.property.domain.Room;
import com.rentmanager.property.dto.CreatePropertyRequest;
import com.rentmanager.property.dto.PropertyDto;
import com.rentmanager.property.kafka.PropertyOutboxService;
import com.rentmanager.property.repository.BuildingRepository;
import com.rentmanager.property.repository.FloorRepository;
import com.rentmanager.property.repository.PropertyRepository;
import com.rentmanager.property.repository.RoomRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class PropertyService {

    private final PropertyRepository propertyRepository;
    private final BuildingRepository buildingRepository;
    private final FloorRepository floorRepository;
    private final RoomRepository roomRepository;
    private final PropertyOutboxService outboxService;

    public PropertyService(PropertyRepository propertyRepository,
                           BuildingRepository buildingRepository,
                           FloorRepository floorRepository,
                           RoomRepository roomRepository,
                           PropertyOutboxService outboxService) {
        this.propertyRepository = propertyRepository;
        this.buildingRepository = buildingRepository;
        this.floorRepository = floorRepository;
        this.roomRepository = roomRepository;
        this.outboxService = outboxService;
    }

    @Transactional(readOnly = true)
    public List<PropertyDto> getProperties(String tenantId) {
        return propertyRepository.findByTenantId(tenantId).stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional(readOnly = true)
    public PropertyDto getPropertyById(String id, String tenantId) {
        Property property = propertyRepository.findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new IllegalArgumentException("Property not found with id: " + id));
        return toDto(property);
    }

    @Transactional
    public PropertyDto createProperty(String tenantId, CreatePropertyRequest request) {
        if (propertyRepository.findByCode(request.code()).isPresent()) {
            throw new IllegalArgumentException("Property code already exists: " + request.code());
        }

        String id = "prop_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        Property property = new Property(id, tenantId, request.code(), request.name(), request.address());
        property.setGeoLat(request.geoLat());
        property.setGeoLng(request.geoLng());
        property.setGeofenceRadiusM(request.geofenceRadiusM());

        Property saved = propertyRepository.save(property);

        outboxService.publishEvent(
            "property.created",
            saved.getId(),
            Map.of(
                "propertyId", saved.getId(),
                "tenantId", saved.getTenantId(),
                "code", saved.getCode(),
                "name", saved.getName()
            )
        );

        return toDto(saved);
    }

    private PropertyDto toDto(Property p) {
        List<Building> buildings = buildingRepository.findByPropertyId(p.getId());
        int roomsTotal = 0;
        int roomsOccupied = 0;
        for (Building b : buildings) {
            for (Floor f : floorRepository.findByBuildingId(b.getId())) {
                List<Room> rooms = roomRepository.findByFloorId(f.getId());
                roomsTotal += rooms.size();
                roomsOccupied += (int) rooms.stream().filter(r -> "occupied".equals(r.getStatus())).count();
            }
        }
        return new PropertyDto(
            p.getId(),
            p.getTenantId(),
            p.getCode(),
            p.getName(),
            p.getAddress(),
            p.getStatus(),
            p.getGeoLat(),
            p.getGeoLng(),
            p.getGeofenceRadiusM(),
            p.getCreatedAt(),
            buildings.size(),
            roomsTotal,
            roomsOccupied
        );
    }
}
