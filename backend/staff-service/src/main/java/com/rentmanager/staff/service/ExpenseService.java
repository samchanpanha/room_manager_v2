package com.rentmanager.staff.service;

import com.rentmanager.staff.domain.Expense;
import com.rentmanager.staff.dto.CreateExpenseRequest;
import com.rentmanager.staff.dto.ExpenseDto;
import com.rentmanager.staff.kafka.StaffOutboxService;
import com.rentmanager.staff.repository.ExpenseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ExpenseService {

    private static final int AUTO_APPROVAL_THRESHOLD = 50000; // $500.00 minor units default threshold

    private final ExpenseRepository expenseRepository;
    private final StaffOutboxService outboxService;

    public ExpenseService(ExpenseRepository expenseRepository, StaffOutboxService outboxService) {
        this.expenseRepository = expenseRepository;
        this.outboxService = outboxService;
    }

    @Transactional(readOnly = true)
    public List<ExpenseDto> getExpensesByProperty(String propertyId) {
        return expenseRepository.findByPropertyId(propertyId).stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public ExpenseDto createExpense(CreateExpenseRequest request, String submittedById) {
        String id = "exp_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String code = "EXP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        Instant date = request.expenseDate() != null ? request.expenseDate() : Instant.now();

        Expense expense = new Expense(
            id, code, request.propertyId(), request.categoryId(), request.vendorName(),
            date, request.amountMinor(), request.paidVia(), submittedById
        );
        expense.setDescription(request.description());

        // Check auto-approval threshold ($500.00)
        if (request.amountMinor() <= AUTO_APPROVAL_THRESHOLD) {
            expense.setStatus("approved");
            expense.setAutoApproved(true);
            expense.setApprovedById("SYSTEM");
            expense.setApprovedAt(Instant.now());
        }

        Expense saved = expenseRepository.save(expense);

        outboxService.publishEvent(
            saved.isAutoApproved() ? "expense.approved" : "expense.created",
            saved.getPropertyId(),
            Map.of(
                "expenseId", saved.getId(),
                "code", saved.getCode(),
                "amountMinor", saved.getAmountMinor(),
                "status", saved.getStatus()
            )
        );

        return toDto(saved);
    }

    @Transactional
    public ExpenseDto approveExpense(String id, String approvedById) {
        Expense expense = expenseRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Expense not found: " + id));

        expense.setStatus("approved");
        expense.setApprovedById(approvedById);
        expense.setApprovedAt(Instant.now());
        expense.setUpdatedAt(Instant.now());

        Expense saved = expenseRepository.save(expense);

        outboxService.publishEvent(
            "expense.approved",
            saved.getPropertyId(),
            Map.of("expenseId", saved.getId(), "code", saved.getCode())
        );

        return toDto(saved);
    }

    private ExpenseDto toDto(Expense e) {
        return new ExpenseDto(
            e.getId(),
            e.getCode(),
            e.getPropertyId(),
            e.getCategoryId(),
            e.getVendorName(),
            e.getDescription(),
            e.getExpenseDate(),
            e.getAmountMinor(),
            e.getPaidVia(),
            e.getStatus(),
            e.isAutoApproved(),
            e.getSubmittedById(),
            e.getCreatedAt()
        );
    }
}
