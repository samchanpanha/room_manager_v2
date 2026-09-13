package com.rentmanager.property.web;

import com.rentmanager.property.domain.Floor;
import com.rentmanager.property.repository.FloorRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/floors")
public class FloorController {

    private final FloorRepository floorRepository;

    public FloorController(FloorRepository floorRepository) {
        this.floorRepository = floorRepository;
    }

    @GetMapping
    public ResponseEntity<List<Floor>> getFloors(@RequestParam String buildingId) {
        return ResponseEntity.ok(floorRepository.findByBuildingId(buildingId));
    }

    @PostMapping
    public ResponseEntity<Floor> createFloor(@RequestBody Floor floor) {
        if (floor.getId() == null || floor.getId().isBlank()) {
            floor.setId("flr_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        }
        Floor created = floorRepository.save(floor);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
