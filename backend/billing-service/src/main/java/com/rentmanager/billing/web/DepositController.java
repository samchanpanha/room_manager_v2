package com.rentmanager.billing.web;

import com.rentmanager.billing.domain.Deposit;
import com.rentmanager.billing.repository.DepositRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/deposits")
public class DepositController {

    private final DepositRepository depositRepository;

    public DepositController(DepositRepository depositRepository) {
        this.depositRepository = depositRepository;
    }

    @GetMapping
    public ResponseEntity<List<Deposit>> getDeposits(@RequestParam(required = false) String propertyId) {
        if (propertyId != null && !propertyId.isBlank()) {
            return ResponseEntity.ok(depositRepository.findByPropertyId(propertyId));
        }
        return ResponseEntity.ok(depositRepository.findAll());
    }
}
