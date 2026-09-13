package com.rentmanager.billing.service;

import com.rentmanager.billing.domain.Lease;
import com.rentmanager.billing.dto.CreateLeaseRequest;
import com.rentmanager.billing.dto.LeaseDto;
import com.rentmanager.billing.kafka.BillingOutboxService;
import com.rentmanager.billing.repository.LeaseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class LeaseService {

    private final LeaseRepository leaseRepository;
    private final BillingOutboxService outboxService;

    public LeaseService(LeaseRepository leaseRepository, BillingOutboxService outboxService) {
        this.leaseRepository = leaseRepository;
        this.outboxService = outboxService;
    }

    @Transactional(readOnly = true)
    public List<LeaseDto> getAllLeases() {
        return leaseRepository.findAll().stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<LeaseDto> getLeasesByProperty(String propertyId) {
        return leaseRepository.findByPropertyId(propertyId).stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional(readOnly = true)
    public LeaseDto getLeaseById(String id) {
        Lease lease = leaseRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Lease not found with id: " + id));
        return toDto(lease);
    }

    @Transactional
    public LeaseDto createLease(CreateLeaseRequest request) {
        String id = "lse_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String code = "LSE-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        Lease lease = new Lease(
            id, code, request.memberProfileId(), request.roomId(), request.propertyId(),
            request.startDate(), request.rentAmountMinor(), request.depositTotalMinor()
        );
        lease.setEndDate(request.endDate());

        Lease saved = leaseRepository.save(lease);

        outboxService.publishEvent(
            "lease.created",
            saved.getPropertyId(),
            Map.of(
                "leaseId", saved.getId(),
                "code", saved.getCode(),
                "memberProfileId", saved.getMemberProfileId(),
                "roomId", saved.getRoomId(),
                "rentAmountMinor", saved.getRentAmountMinor()
            )
        );

        return toDto(saved);
    }

    @Transactional
    public LeaseDto activateLease(String id) {
        Lease lease = leaseRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Lease not found with id: " + id));

        lease.setStatus("active");
        lease.setUpdatedAt(Instant.now());
        Lease saved = leaseRepository.save(lease);

        outboxService.publishEvent(
            "lease.activated",
            saved.getPropertyId(),
            Map.of(
                "leaseId", saved.getId(),
                "code", saved.getCode(),
                "memberProfileId", saved.getMemberProfileId()
            )
        );

        return toDto(saved);
    }

    private LeaseDto toDto(Lease l) {
        return new LeaseDto(
            l.getId(),
            l.getCode(),
            l.getMemberProfileId(),
            l.getRoomId(),
            l.getPropertyId(),
            l.getStatus(),
            l.getStartDate(),
            l.getEndDate(),
            l.getRentAmountMinor(),
            l.getBillingCycleDay(),
            l.getDepositTotalMinor(),
            l.getCreatedAt()
        );
    }
}
