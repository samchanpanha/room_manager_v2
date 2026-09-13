package com.rentmanager.ops.service;

import com.rentmanager.ops.domain.Complaint;
import com.rentmanager.ops.dto.ComplaintDto;
import com.rentmanager.ops.dto.CreateComplaintRequest;
import com.rentmanager.ops.kafka.OpsOutboxService;
import com.rentmanager.ops.repository.ComplaintRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ComplaintService {

    private final ComplaintRepository complaintRepository;
    private final OpsOutboxService outboxService;

    public ComplaintService(ComplaintRepository complaintRepository, OpsOutboxService outboxService) {
        this.complaintRepository = complaintRepository;
        this.outboxService = outboxService;
    }

    @Transactional(readOnly = true)
    public List<ComplaintDto> getComplaintsByProperty(String propertyId) {
        return complaintRepository.findByPropertyId(propertyId).stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public ComplaintDto createComplaint(CreateComplaintRequest request) {
        String id = "cmp_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String code = "CMP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        Instant slaDueAt = Instant.now().plusSeconds(86400 * 2); // 48h SLA default

        Complaint complaint = new Complaint(
            id, code, request.propertyId(), request.memberProfileId(), request.category(), request.subject(), request.description(), slaDueAt
        );
        complaint.setLeaseId(request.leaseId());
        if (request.priority() != null) complaint.setPriority(request.priority());

        Complaint saved = complaintRepository.save(complaint);

        outboxService.publishEvent(
            "complaint.created",
            saved.getPropertyId(),
            Map.of(
                "complaintId", saved.getId(),
                "code", saved.getCode(),
                "category", saved.getCategory(),
                "subject", saved.getSubject()
            )
        );

        return toDto(saved);
    }

    private ComplaintDto toDto(Complaint c) {
        return new ComplaintDto(
            c.getId(),
            c.getCode(),
            c.getPropertyId(),
            c.getMemberProfileId(),
            c.getLeaseId(),
            c.getCategory(),
            c.getPriority(),
            c.getSource(),
            c.getStatus(),
            c.getSubject(),
            c.getDescription(),
            c.getSlaDueAt(),
            c.getAssignedToId(),
            c.getTicketId(),
            c.getResolvedAt(),
            c.getCreatedAt()
        );
    }
}
