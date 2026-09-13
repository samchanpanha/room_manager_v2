package com.rentmanager.staff;

import com.rentmanager.staff.domain.Expense;
import com.rentmanager.staff.dto.CreateExpenseRequest;
import com.rentmanager.staff.dto.ExpenseDto;
import com.rentmanager.staff.kafka.StaffOutboxService;
import com.rentmanager.staff.repository.ExpenseRepository;
import com.rentmanager.staff.service.ExpenseService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ExpenseServiceTest {

    private ExpenseRepository expenseRepository;
    private StaffOutboxService outboxService;
    private ExpenseService expenseService;

    @BeforeEach
    void setUp() {
        expenseRepository = mock(ExpenseRepository.class);
        outboxService = mock(StaffOutboxService.class);
        expenseService = new ExpenseService(expenseRepository, outboxService);
    }

    @Test
    void createExpense_UnderThreshold_AutoApproves() {
        CreateExpenseRequest request = new CreateExpenseRequest(
            "prop_01", "cat_01", "Office Depot", "Supplies", Instant.now(), 25000, "cash"
        );

        when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> inv.getArgument(0));

        ExpenseDto dto = expenseService.createExpense(request, "user_01");

        assertNotNull(dto);
        assertTrue(dto.autoApproved());
        assertEquals("approved", dto.status());
        verify(outboxService).publishEvent(eq("expense.approved"), eq("prop_01"), anyMap());
    }

    @Test
    void createExpense_OverThreshold_RequiresManualApproval() {
        CreateExpenseRequest request = new CreateExpenseRequest(
            "prop_01", "cat_01", "AC Repair Co", "HVAC overhaul", Instant.now(), 150000, "bank_transfer"
        );

        when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> inv.getArgument(0));

        ExpenseDto dto = expenseService.createExpense(request, "user_01");

        assertNotNull(dto);
        assertFalse(dto.autoApproved());
        assertEquals("pending", dto.status());
        verify(outboxService).publishEvent(eq("expense.created"), eq("prop_01"), anyMap());
    }
}
