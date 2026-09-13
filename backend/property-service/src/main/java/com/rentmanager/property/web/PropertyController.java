package com.rentmanager.property.web;

import com.rentmanager.property.dto.CreatePropertyRequest;
import com.rentmanager.property.dto.PropertyDto;
import com.rentmanager.property.service.PropertyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/properties")
public class PropertyController {

    private final PropertyService propertyService;

    public PropertyController(PropertyService propertyService) {
        this.propertyService = propertyService;
    }

    @GetMapping
    public ResponseEntity<List<PropertyDto>> getProperties(
            @RequestHeader(value = "X-Rm-Tenant-Id", defaultValue = "DEFAULT") String tenantId) {
        return ResponseEntity.ok(propertyService.getProperties(tenantId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PropertyDto> getPropertyById(
            @PathVariable String id,
            @RequestHeader(value = "X-Rm-Tenant-Id", defaultValue = "DEFAULT") String tenantId) {
        return ResponseEntity.ok(propertyService.getPropertyById(id, tenantId));
    }

    @PostMapping
    public ResponseEntity<PropertyDto> createProperty(
            @RequestHeader(value = "X-Rm-Tenant-Id", defaultValue = "DEFAULT") String tenantId,
            @Valid @RequestBody CreatePropertyRequest request) {
        PropertyDto created = propertyService.createProperty(tenantId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
