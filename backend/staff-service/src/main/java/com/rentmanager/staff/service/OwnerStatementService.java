package com.rentmanager.staff.service;

import com.rentmanager.staff.domain.OwnerStatement;
import com.rentmanager.staff.dto.GenerateOwnerStatementRequest;
import com.rentmanager.staff.dto.OwnerStatementDto;
import com.rentmanager.staff.kafka.StaffOutboxService;
import com.rentmanager.staff.repository.OwnerStatementRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class OwnerStatementService {

    private final OwnerStatementRepository statementRepository;
    private final StaffOutboxService outboxService;

    public OwnerStatementService(OwnerStatementRepository statementRepository, StaffOutboxService outboxService) {
        this.statementRepository = statementRepository;
        this.outboxService = outboxService;
    }

    @Transactional(readOnly = true)
    public List<OwnerStatementDto> getStatementsByOwner(String ownerProfileId) {
        return statementRepository.findByOwnerProfileId(ownerProfileId).stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public OwnerStatementDto generateStatement(GenerateOwnerStatementRequest request) {
        String id = "stm_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String code = "STM-" + request.month() + "-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase();

        int netMinor = request.grossShareMinor() - request.managementFeeMinor();

        OwnerStatement statement = new OwnerStatement(
            id, code, request.ownerProfileId(), request.contractId(), request.buildingId(), request.propertyId(),
            request.month(), request.collectedMinor(), request.grossShareMinor(), request.managementFeeMinor(), netMinor, "{}"
        );

        OwnerStatement saved = statementRepository.save(statement);

        outboxService.publishEvent(
            "owner_statement.generated",
            saved.getPropertyId(),
            Map.of(
                "statementId", saved.getId(),
                "code", saved.getCode(),
                "ownerProfileId", saved.getOwnerProfileId(),
                "month", saved.getMonth(),
                "netMinor", saved.getNetMinor()
            )
        );

        return toDto(saved);
    }

    @Transactional
    public OwnerStatementDto approveStatement(String id) {
        OwnerStatement statement = statementRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Owner statement not found: " + id));

        statement.setStatus("approved");
        statement.setUpdatedAt(Instant.now());
        OwnerStatement saved = statementRepository.save(statement);

        outboxService.publishEvent(
            "owner_statement.approved",
            saved.getPropertyId(),
            Map.of("statementId", saved.getId(), "code", saved.getCode())
        );

        return toDto(saved);
    }

    private OwnerStatementDto toDto(OwnerStatement s) {
        return new OwnerStatementDto(
            s.getId(),
            s.getCode(),
            s.getOwnerProfileId(),
            s.getContractId(),
            s.getBuildingId(),
            s.getPropertyId(),
            s.getMonth(),
            s.getStatus(),
            s.getCollectedMinor(),
            s.getGrossShareMinor(),
            s.getManagementFeeMinor(),
            s.getNetMinor(),
            s.getCreatedAt()
        );
    }
}
