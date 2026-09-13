package com.rentmanager.staff.web;

import com.rentmanager.staff.dto.GenerateOwnerStatementRequest;
import com.rentmanager.staff.dto.OwnerStatementDto;
import com.rentmanager.staff.service.OwnerStatementService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/owner-statements")
public class OwnerStatementController {

    private final OwnerStatementService statementService;

    public OwnerStatementController(OwnerStatementService statementService) {
        this.statementService = statementService;
    }

    @GetMapping
    public ResponseEntity<List<OwnerStatementDto>> getStatementsByOwner(@RequestParam String ownerProfileId) {
        return ResponseEntity.ok(statementService.getStatementsByOwner(ownerProfileId));
    }

    @PostMapping
    public ResponseEntity<OwnerStatementDto> generateStatement(@Valid @RequestBody GenerateOwnerStatementRequest request) {
        OwnerStatementDto created = statementService.generateStatement(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<OwnerStatementDto> approveStatement(@PathVariable String id) {
        return ResponseEntity.ok(statementService.approveStatement(id));
    }
}
