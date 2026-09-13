package com.rentmanager.ops.web;

import com.rentmanager.ops.dto.CreateTicketRequest;
import com.rentmanager.ops.dto.MaintenanceTicketDto;
import com.rentmanager.ops.dto.UpdateTicketStatusRequest;
import com.rentmanager.ops.service.MaintenanceService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/tickets", "/api/maintenance"})
public class MaintenanceController {

    private final MaintenanceService maintenanceService;

    public MaintenanceController(MaintenanceService maintenanceService) {
        this.maintenanceService = maintenanceService;
    }

    @GetMapping
    public ResponseEntity<List<MaintenanceTicketDto>> getTicketsByProperty(@RequestParam String propertyId) {
        return ResponseEntity.ok(maintenanceService.getTicketsByProperty(propertyId));
    }

    @PostMapping
    public ResponseEntity<MaintenanceTicketDto> createTicket(@Valid @RequestBody CreateTicketRequest request) {
        MaintenanceTicketDto created = maintenanceService.createTicket(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<MaintenanceTicketDto> updateTicketStatus(
            @PathVariable String id,
            @Valid @RequestBody UpdateTicketStatusRequest request) {
        return ResponseEntity.ok(maintenanceService.updateTicketStatus(id, request));
    }
}
