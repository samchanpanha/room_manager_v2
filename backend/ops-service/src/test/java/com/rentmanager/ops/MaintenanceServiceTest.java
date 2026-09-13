package com.rentmanager.ops;

import com.rentmanager.ops.domain.MaintenanceTicket;
import com.rentmanager.ops.dto.CreateTicketRequest;
import com.rentmanager.ops.dto.MaintenanceTicketDto;
import com.rentmanager.ops.dto.UpdateTicketStatusRequest;
import com.rentmanager.ops.kafka.OpsOutboxService;
import com.rentmanager.ops.repository.MaintenanceTicketRepository;
import com.rentmanager.ops.service.MaintenanceService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MaintenanceServiceTest {

    private MaintenanceTicketRepository ticketRepository;
    private OpsOutboxService outboxService;
    private MaintenanceService maintenanceService;

    @BeforeEach
    void setUp() {
        ticketRepository = mock(MaintenanceTicketRepository.class);
        outboxService = mock(OpsOutboxService.class);
        maintenanceService = new MaintenanceService(ticketRepository, outboxService);
    }

    @Test
    void createTicket_Success_CalculatesSlaAndQueuesOutbox() {
        CreateTicketRequest request = new CreateTicketRequest(
            "prop_01", "rm_101", "lse_01", "mem_01",
            "plumbing", "urgent", "Leaking pipe", "Water leaking under sink", "portal"
        );

        when(ticketRepository.save(any(MaintenanceTicket.class))).thenAnswer(inv -> inv.getArgument(0));

        MaintenanceTicketDto dto = maintenanceService.createTicket(request);

        assertNotNull(dto);
        assertEquals("urgent", dto.priority());
        assertEquals("open", dto.status());
        assertNotNull(dto.slaDueAt());

        verify(outboxService, times(1)).publishEvent(eq("ticket.created"), eq("prop_01"), anyMap());
    }

    @Test
    void updateTicketStatus_Resolved_EmitsResolvedEvent() {
        MaintenanceTicket ticket = new MaintenanceTicket(
            "tk_01", "TK-001", "prop_01", "plumbing", "high", "Pipe leak", "Fix leak", java.time.Instant.now()
        );

        when(ticketRepository.findById("tk_01")).thenReturn(Optional.of(ticket));
        when(ticketRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        UpdateTicketStatusRequest request = new UpdateTicketStatusRequest("resolved", "tech_01", "Replaced pipe seal");
        MaintenanceTicketDto updated = maintenanceService.updateTicketStatus("tk_01", request);

        assertEquals("resolved", updated.status());
        verify(outboxService).publishEvent(eq("ticket.resolved"), eq("prop_01"), anyMap());
    }
}
