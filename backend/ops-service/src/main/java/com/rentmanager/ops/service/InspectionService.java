package com.rentmanager.ops.service;

import com.rentmanager.ops.domain.Inspection;
import com.rentmanager.ops.dto.CreateInspectionRequest;
import com.rentmanager.ops.dto.InspectionDto;
import com.rentmanager.ops.kafka.OpsOutboxService;
import com.rentmanager.ops.repository.InspectionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class InspectionService {

    private final InspectionRepository inspectionRepository;
    private final OpsOutboxService outboxService;

    public InspectionService(InspectionRepository inspectionRepository, OpsOutboxService outboxService) {
        this.inspectionRepository = inspectionRepository;
        this.outboxService = outboxService;
    }

    @Transactional(readOnly = true)
    public List<InspectionDto> getInspectionsByProperty(String propertyId) {
        return inspectionRepository.findByPropertyId(propertyId).stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public InspectionDto createInspection(CreateInspectionRequest request) {
        String id = "insp_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String code = "INSP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        Inspection inspection = new Inspection(
            id, code, request.type(), request.leaseId(), request.roomId(), request.propertyId()
        );
        inspection.setScheduledAt(request.scheduledAt());

        Inspection saved = inspectionRepository.save(inspection);

        outboxService.publishEvent(
            "inspection.created",
            saved.getPropertyId(),
            Map.of(
                "inspectionId", saved.getId(),
                "code", saved.getCode(),
                "type", saved.getType(),
                "roomId", saved.getRoomId()
            )
        );

        return toDto(saved);
    }

    @Transactional
    public InspectionDto completeInspection(String id, int overallScore, String summaryNote) {
        Inspection inspection = inspectionRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Inspection not found: " + id));

        inspection.setStatus("completed");
        inspection.setCompletedAt(Instant.now());
        inspection.setOverallScore(overallScore);
        inspection.setSummaryNote(summaryNote);
        inspection.setUpdatedAt(Instant.now());

        Inspection saved = inspectionRepository.save(inspection);

        outboxService.publishEvent(
            "inspection.completed",
            saved.getPropertyId(),
            Map.of(
                "inspectionId", saved.getId(),
                "code", saved.getCode(),
                "overallScore", overallScore
            )
        );

        return toDto(saved);
    }

    private InspectionDto toDto(Inspection i) {
        return new InspectionDto(
            i.getId(),
            i.getCode(),
            i.getType(),
            i.getStatus(),
            i.getLeaseId(),
            i.getRoomId(),
            i.getPropertyId(),
            i.getScheduledAt(),
            i.getCompletedAt(),
            i.getOverallScore(),
            i.getSummaryNote(),
            i.getCreatedAt()
        );
    }
}
