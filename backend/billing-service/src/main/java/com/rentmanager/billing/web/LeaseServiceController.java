package com.rentmanager.billing.web;

import com.rentmanager.billing.domain.LeaseService;
import com.rentmanager.billing.repository.LeaseServiceRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/lease-services")
public class LeaseServiceController {

    private final LeaseServiceRepository leaseServiceRepository;

    public LeaseServiceController(LeaseServiceRepository leaseServiceRepository) {
        this.leaseServiceRepository = leaseServiceRepository;
    }

    @GetMapping
    public ResponseEntity<List<LeaseService>> getLeaseServices(@RequestParam String leaseId) {
        return ResponseEntity.ok(leaseServiceRepository.findByLeaseId(leaseId));
    }
}
