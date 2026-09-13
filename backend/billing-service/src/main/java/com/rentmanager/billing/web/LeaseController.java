package com.rentmanager.billing.web;

import com.rentmanager.billing.dto.CreateLeaseRequest;
import com.rentmanager.billing.dto.LeaseDto;
import com.rentmanager.billing.service.LeaseService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/leases")
public class LeaseController {

    private final LeaseService leaseService;

    public LeaseController(LeaseService leaseService) {
        this.leaseService = leaseService;
    }

    @GetMapping
    public ResponseEntity<List<LeaseDto>> listLeases(@RequestParam(required = false) String propertyId) {
        if (propertyId == null || propertyId.isBlank()) {
            return ResponseEntity.ok(leaseService.getAllLeases());
        }
        return ResponseEntity.ok(leaseService.getLeasesByProperty(propertyId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<LeaseDto> getLeaseById(@PathVariable String id) {
        return ResponseEntity.ok(leaseService.getLeaseById(id));
    }

    @PostMapping
    public ResponseEntity<LeaseDto> createLease(@Valid @RequestBody CreateLeaseRequest request) {
        LeaseDto created = leaseService.createLease(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/{id}/activate")
    public ResponseEntity<LeaseDto> activateLease(@PathVariable String id) {
        return ResponseEntity.ok(leaseService.activateLease(id));
    }
}
