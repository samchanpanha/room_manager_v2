package com.rentmanager.property.web;

import com.rentmanager.property.domain.Building;
import com.rentmanager.property.repository.BuildingRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/buildings")
public class BuildingController {

    private final BuildingRepository buildingRepository;

    public BuildingController(BuildingRepository buildingRepository) {
        this.buildingRepository = buildingRepository;
    }

    @GetMapping
    public ResponseEntity<List<Building>> getBuildings(@RequestParam String propertyId) {
        return ResponseEntity.ok(buildingRepository.findByPropertyId(propertyId));
    }

    @PostMapping
    public ResponseEntity<Building> createBuilding(@RequestBody Building building) {
        if (building.getId() == null || building.getId().isBlank()) {
            building.setId("bldg_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        }
        Building created = buildingRepository.save(building);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
