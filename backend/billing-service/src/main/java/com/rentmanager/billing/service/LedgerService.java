package com.rentmanager.billing.service;

import com.rentmanager.billing.domain.LedgerAccount;
import com.rentmanager.billing.domain.LedgerEntry;
import com.rentmanager.billing.domain.LedgerTransaction;
import com.rentmanager.billing.dto.LedgerPostingRequest;
import com.rentmanager.billing.dto.LedgerTransactionDto;
import com.rentmanager.billing.repository.LedgerAccountRepository;
import com.rentmanager.billing.repository.LedgerEntryRepository;
import com.rentmanager.billing.repository.LedgerTransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class LedgerService {

    private final LedgerAccountRepository accountRepository;
    private final LedgerTransactionRepository transactionRepository;
    private final LedgerEntryRepository entryRepository;

    public LedgerService(LedgerAccountRepository accountRepository,
                         LedgerTransactionRepository transactionRepository,
                         LedgerEntryRepository entryRepository) {
        this.accountRepository = accountRepository;
        this.transactionRepository = transactionRepository;
        this.entryRepository = entryRepository;
    }

    @Transactional
    public LedgerTransaction postTransaction(LedgerPostingRequest request, String createdById) {
        int totalDebit = 0;
        int totalCredit = 0;

        for (var reqEntry : request.entries()) {
            if (reqEntry.debit() < 0 || reqEntry.credit() < 0) {
                throw new IllegalArgumentException("Debit/credit amounts must be non-negative");
            }
            if (reqEntry.debit() > 0 && reqEntry.credit() > 0) {
                throw new IllegalArgumentException("Each entry line must have either debit OR credit > 0, not both");
            }
            totalDebit += reqEntry.debit();
            totalCredit += reqEntry.credit();
        }

        // STRICT DOUBLE-ENTRY FINANCIAL CHECK: SUM(debits) MUST EQUAL SUM(credits) > 0
        if (totalDebit <= 0 || totalDebit != totalCredit) {
            throw new IllegalArgumentException(
                String.format("Unbalanced ledger transaction! totalDebit=%d, totalCredit=%d. Sum of debits must equal sum of credits and be > 0.", totalDebit, totalCredit)
            );
        }

        String txId = "tx_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        LedgerTransaction tx = new LedgerTransaction(
            txId, request.memo(), request.refType(), request.refId(),
            request.propertyId(), request.memberId(), totalDebit, totalCredit
        );
        tx.setCreatedById(createdById);
        LedgerTransaction savedTx = transactionRepository.save(tx);

        List<LedgerEntry> entriesToSave = new ArrayList<>();
        for (var reqEntry : request.entries()) {
            LedgerAccount account = accountRepository.findByCode(reqEntry.accountCode())
                .orElseGet(() -> {
                    // Auto-seed system account if missing (e.g. 1100, 1200, 2100, 4000)
                    String type = inferAccountType(reqEntry.accountCode());
                    return accountRepository.save(new LedgerAccount("acc_" + reqEntry.accountCode(), reqEntry.accountCode(), "Account " + reqEntry.accountCode(), type));
                });

            String entryId = "entry_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
            LedgerEntry entry = new LedgerEntry(entryId, savedTx.getId(), account.getId(), reqEntry.debit(), reqEntry.credit(), reqEntry.memo());
            entry.setPropertyId(request.propertyId());
            entry.setMemberId(request.memberId());
            entriesToSave.add(entry);
        }

        entryRepository.saveAll(entriesToSave);
        return savedTx;
    }

    @Transactional(readOnly = true)
    public List<LedgerTransactionDto> getTransactionsByRef(String refType, String refId) {
        return transactionRepository.findByRefTypeAndRefId(refType, refId).stream()
            .map(this::toDto)
            .toList();
    }

    private LedgerTransactionDto toDto(LedgerTransaction tx) {
        return new LedgerTransactionDto(
            tx.getId(),
            tx.getPostedAt(),
            tx.getMemo(),
            tx.getRefType(),
            tx.getRefId(),
            tx.getPropertyId(),
            tx.getMemberId(),
            tx.getTotalDebit(),
            tx.getTotalCredit(),
            tx.getCreatedAt()
        );
    }

    private String inferAccountType(String code) {
        if (code.startsWith("1")) return "ASSET";
        if (code.startsWith("2")) return "LIABILITY";
        if (code.startsWith("3")) return "EQUITY";
        if (code.startsWith("4")) return "INCOME";
        return "EXPENSE";
    }
}
