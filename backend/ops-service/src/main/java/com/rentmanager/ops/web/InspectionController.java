package com.rentmanager.ops.web;

import com.rentmanager.ops.dto.CreateInspectionRequest;
import com.rentmanager.ops.dto.InspectionDto;
import com.rentmanager.ops.service.InspectionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/inspections")
public class InspectionController {

    private final InspectionService inspectionService;

    public InspectionController(InspectionService inspectionService) {
        this.inspectionService = inspectionService;
    }

    @GetMapping
    public ResponseEntity<List<InspectionDto>> getInspectionsByProperty(@RequestParam String propertyId) {
        return ResponseEntity.ok(inspectionService.getInspectionsByProperty(propertyId));
    }

    @PostMapping
    public ResponseEntity<InspectionDto> createInspection(@Valid @RequestBody CreateInspectionRequest request) {
        InspectionDto created = inspectionService.createInspection(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<InspectionDto> completeInspection(
            @PathVariable String id,
            @RequestParam int score,
            @RequestParam(required = false) String note) {
        return ResponseEntity.ok(inspectionService.completeInspection(id, score, note));
    }
}
