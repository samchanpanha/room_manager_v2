package com.rentmanager.staff.web;

import com.rentmanager.staff.dto.CreateExpenseRequest;
import com.rentmanager.staff.dto.ExpenseDto;
import com.rentmanager.staff.service.ExpenseService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    @GetMapping
    public ResponseEntity<List<ExpenseDto>> getExpensesByProperty(@RequestParam String propertyId) {
        return ResponseEntity.ok(expenseService.getExpensesByProperty(propertyId));
    }

    @PostMapping
    public ResponseEntity<ExpenseDto> createExpense(
            @RequestHeader(value = "X-Rm-User-Id", defaultValue = "SYSTEM") String userId,
            @Valid @RequestBody CreateExpenseRequest request) {
        ExpenseDto created = expenseService.createExpense(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ExpenseDto> approveExpense(
            @PathVariable String id,
            @RequestHeader(value = "X-Rm-User-Id", defaultValue = "SYSTEM") String userId) {
        return ResponseEntity.ok(expenseService.approveExpense(id, userId));
    }
}
