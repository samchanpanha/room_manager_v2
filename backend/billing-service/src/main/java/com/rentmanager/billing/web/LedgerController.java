package com.rentmanager.billing.web;

import com.rentmanager.billing.domain.LedgerTransaction;
import com.rentmanager.billing.dto.LedgerPostingRequest;
import com.rentmanager.billing.dto.LedgerTransactionDto;
import com.rentmanager.billing.service.LedgerService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ledger")
public class LedgerController {

    private final LedgerService ledgerService;

    public LedgerController(LedgerService ledgerService) {
        this.ledgerService = ledgerService;
    }

    @GetMapping("/transactions")
    public ResponseEntity<List<LedgerTransactionDto>> getTransactionsByRef(
            @RequestParam String refType,
            @RequestParam String refId) {
        return ResponseEntity.ok(ledgerService.getTransactionsByRef(refType, refId));
    }

    @PostMapping("/postings")
    public ResponseEntity<LedgerTransaction> postTransaction(
            @RequestHeader(value = "X-Rm-User-Id", required = false) String userId,
            @Valid @RequestBody LedgerPostingRequest request) {
        LedgerTransaction tx = ledgerService.postTransaction(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(tx);
    }
}
