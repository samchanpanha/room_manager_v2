package com.rentmanager.ops.service;

import com.rentmanager.ops.domain.MaintenanceTicket;
import com.rentmanager.ops.dto.CreateTicketRequest;
import com.rentmanager.ops.dto.MaintenanceTicketDto;
import com.rentmanager.ops.dto.UpdateTicketStatusRequest;
import com.rentmanager.ops.kafka.OpsOutboxService;
import com.rentmanager.ops.repository.MaintenanceTicketRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class MaintenanceService {

    private final MaintenanceTicketRepository ticketRepository;
    private final OpsOutboxService outboxService;

    public MaintenanceService(MaintenanceTicketRepository ticketRepository, OpsOutboxService outboxService) {
        this.ticketRepository = ticketRepository;
        this.outboxService = outboxService;
    }

    @Transactional(readOnly = true)
    public List<MaintenanceTicketDto> getTicketsByProperty(String propertyId) {
        return ticketRepository.findByPropertyId(propertyId).stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public MaintenanceTicketDto createTicket(CreateTicketRequest request) {
        String id = "tk_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String code = "TK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        String priority = request.priority() != null ? request.priority() : "medium";
        int slaHours = switch (priority) {
            case "urgent" -> 4;
            case "high" -> 12;
            case "low" -> 48;
            default -> 24;
        };
        Instant slaDueAt = Instant.now().plusSeconds(slaHours * 3600L);

        MaintenanceTicket ticket = new MaintenanceTicket(
            id, code, request.propertyId(), request.category(), priority, request.title(), request.description(), slaDueAt
        );
        ticket.setRoomId(request.roomId());
        ticket.setLeaseId(request.leaseId());
        ticket.setMemberProfileId(request.memberProfileId());
        if (request.source() != null) ticket.setSource(request.source());

        MaintenanceTicket saved = ticketRepository.save(ticket);

        outboxService.publishEvent(
            "ticket.created",
            saved.getPropertyId(),
            Map.of(
                "ticketId", saved.getId(),
                "code", saved.getCode(),
                "category", saved.getCategory(),
                "priority", saved.getPriority(),
                "title", saved.getTitle()
            )
        );

        return toDto(saved);
    }

    @Transactional
    public MaintenanceTicketDto updateTicketStatus(String id, UpdateTicketStatusRequest request) {
        MaintenanceTicket ticket = ticketRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Ticket not found: " + id));

        ticket.setStatus(request.status());
        if (request.assignedToId() != null) {
            ticket.setAssignedToId(request.assignedToId());
        }
        if ("resolved".equalsIgnoreCase(request.status()) || "closed".equalsIgnoreCase(request.status())) {
            ticket.setResolvedAt(Instant.now());
        }
        ticket.setUpdatedAt(Instant.now());

        MaintenanceTicket saved = ticketRepository.save(ticket);

        outboxService.publishEvent(
            "resolved".equalsIgnoreCase(request.status()) ? "ticket.resolved" : "ticket.updated",
            saved.getPropertyId(),
            Map.of(
                "ticketId", saved.getId(),
                "code", saved.getCode(),
                "status", saved.getStatus()
            )
        );

        return toDto(saved);
    }

    private MaintenanceTicketDto toDto(MaintenanceTicket t) {
        return new MaintenanceTicketDto(
            t.getId(),
            t.getCode(),
            t.getPropertyId(),
            t.getRoomId(),
            t.getLeaseId(),
            t.getMemberProfileId(),
            t.getCategory(),
            t.getPriority(),
            t.getStatus(),
            t.getTitle(),
            t.getDescription(),
            t.getSource(),
            t.getSlaDueAt(),
            t.getAssignedToId(),
            t.getResolvedAt(),
            t.getCreatedAt()
        );
    }
}
