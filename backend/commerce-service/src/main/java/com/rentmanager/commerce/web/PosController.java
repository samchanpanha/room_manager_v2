package com.rentmanager.commerce.web;

import com.rentmanager.commerce.dto.*;
import com.rentmanager.commerce.service.PosService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pos")
public class PosController {

    private final PosService posService;

    public PosController(PosService posService) {
        this.posService = posService;
    }

    @PostMapping("/sessions")
    public ResponseEntity<PosSessionDto> openSession(
            @RequestHeader(value = "X-Rm-User-Id", defaultValue = "SYSTEM") String userId,
            @Valid @RequestBody OpenSessionRequest request) {
        PosSessionDto session = posService.openSession(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(session);
    }

    @PostMapping("/sessions/{id}/close")
    public ResponseEntity<PosSessionDto> closeSession(
            @PathVariable String id,
            @RequestHeader(value = "X-Rm-User-Id", defaultValue = "SYSTEM") String userId,
            @Valid @RequestBody CloseSessionRequest request) {
        PosSessionDto session = posService.closeSession(id, request, userId);
        return ResponseEntity.ok(session);
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<PosSessionDto>> getSessions(@RequestParam String propertyId) {
        return ResponseEntity.ok(posService.getSessions(propertyId));
    }

    @GetMapping("/sessions/active")
    public ResponseEntity<PosSessionDto> getActiveSession(@RequestParam String propertyId) {
        PosSessionDto active = posService.getActiveSession(propertyId);
        if (active == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(active);
    }

    @PostMapping("/sales")
    public ResponseEntity<PosSaleDto> createSale(
            @RequestHeader(value = "X-Rm-User-Id", defaultValue = "SYSTEM") String userId,
            @Valid @RequestBody CreateSaleRequest request) {
        PosSaleDto sale = posService.createSale(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(sale);
    }

    @GetMapping("/sales/{id}")
    public ResponseEntity<PosSaleDto> getSale(@PathVariable String id) {
        return ResponseEntity.ok(posService.getSale(id));
    }

    @GetMapping("/sessions/{id}/sales")
    public ResponseEntity<List<PosSaleDto>> getSalesBySession(@PathVariable String id) {
        return ResponseEntity.ok(posService.getSalesBySession(id));
    }
}
