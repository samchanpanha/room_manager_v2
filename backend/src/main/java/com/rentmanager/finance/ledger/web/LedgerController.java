package com.rentmanager.finance.ledger.web;

import com.rentmanager.finance.ledger.dto.AccountDto;
import com.rentmanager.finance.ledger.dto.JournalTxnDto;
import com.rentmanager.finance.ledger.dto.TrialBalance;
import com.rentmanager.finance.ledger.service.LedgerQueryService;
import com.rentmanager.platform.security.CurrentUser;
import java.time.Instant;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

/**
 * REST for M08, mirroring {@code src/app/api/ledger/*}: chart of accounts, trial
 * balance and the journal browser. All require GLOBAL M08:read. The ledger is
 * append-only, so there are no write endpoints — postings happen through the
 * billing/finance SPIs on domain events.
 */
@RestController
@RequestMapping("/api/ledger")
public class LedgerController {

  private final LedgerQueryService service;
  private final CurrentUser currentUser;

  public LedgerController(LedgerQueryService service, CurrentUser currentUser) {
    this.service = service;
    this.currentUser = currentUser;
  }

  @GetMapping("/accounts")
  public List<AccountDto> accounts() {
    return service.listAccounts(currentUser.require());
  }

  @GetMapping("/trial-balance")
  public TrialBalance trialBalance() {
    return service.trialBalance(currentUser.require());
  }

  @GetMapping("/journal")
  public List<JournalTxnDto> journal(
      @RequestParam(required = false) String account,
      @RequestParam(required = false) String propertyId,
      @RequestParam(required = false) String memberId,
      @RequestParam(required = false) String refType,
      @RequestParam(required = false) String refId,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
      @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
      @RequestParam(required = false) Integer take) {
    return service.journal(currentUser.require(), account, propertyId, memberId, refType, refId,
        from, to, take);
  }
}
