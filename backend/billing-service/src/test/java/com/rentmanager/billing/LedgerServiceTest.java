package com.rentmanager.billing;

import com.rentmanager.billing.domain.LedgerAccount;
import com.rentmanager.billing.domain.LedgerTransaction;
import com.rentmanager.billing.dto.LedgerPostingRequest;
import com.rentmanager.billing.repository.LedgerAccountRepository;
import com.rentmanager.billing.repository.LedgerEntryRepository;
import com.rentmanager.billing.repository.LedgerTransactionRepository;
import com.rentmanager.billing.service.LedgerService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class LedgerServiceTest {

    private LedgerAccountRepository accountRepository;
    private LedgerTransactionRepository transactionRepository;
    private LedgerEntryRepository entryRepository;
    private LedgerService ledgerService;

    @BeforeEach
    void setUp() {
        accountRepository = mock(LedgerAccountRepository.class);
        transactionRepository = mock(LedgerTransactionRepository.class);
        entryRepository = mock(LedgerEntryRepository.class);
        ledgerService = new LedgerService(accountRepository, transactionRepository, entryRepository);

        when(accountRepository.findByCode(anyString())).thenAnswer(inv -> {
            String code = inv.getArgument(0);
            return Optional.of(new LedgerAccount("acc_" + code, code, "Test " + code, "ASSET"));
        });
    }

    @Test
    void postTransaction_BalancedEntry_Success() {
        LedgerPostingRequest request = new LedgerPostingRequest(
            "Invoice posting", "invoice", "inv_01", "prop_01", "mem_01",
            List.of(
                new LedgerPostingRequest.EntryRequest("1200", 50000, 0, "AR"),
                new LedgerPostingRequest.EntryRequest("4000", 0, 50000, "Revenue")
            )
        );

        when(transactionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        LedgerTransaction tx = ledgerService.postTransaction(request, "user_01");

        assertNotNull(tx);
        assertEquals(50000, tx.getTotalDebit());
        assertEquals(50000, tx.getTotalCredit());
        verify(entryRepository, times(1)).saveAll(any());
    }

    @Test
    void postTransaction_UnbalancedEntry_ThrowsException() {
        LedgerPostingRequest request = new LedgerPostingRequest(
            "Unbalanced entry", "invoice", "inv_01", "prop_01", "mem_01",
            List.of(
                new LedgerPostingRequest.EntryRequest("1200", 50000, 0, "AR"),
                new LedgerPostingRequest.EntryRequest("4000", 0, 40000, "Revenue")
            )
        );

        IllegalArgumentException ex = assertThrows(
            IllegalArgumentException.class,
            () -> ledgerService.postTransaction(request, "user_01")
        );

        assertTrue(ex.getMessage().contains("Unbalanced ledger transaction"));
        verify(transactionRepository, never()).save(any());
    }
}
