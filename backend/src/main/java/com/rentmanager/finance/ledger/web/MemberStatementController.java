package com.rentmanager.finance.ledger.web;

import com.rentmanager.finance.ledger.dto.MemberStatementResponse;
import com.rentmanager.finance.ledger.service.LedgerQueryService;
import com.rentmanager.platform.security.CurrentUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Member account statement endpoint (M08), mounted at the same path as the Next
 * handler ({@code /api/members/{id}/statement}) so the frontend switch is a
 * no-op. GLOBAL M08:read sees anyone; a member sees only their own statement.
 * Lives in finance because the statement is derived from the ledger, but reads
 * the member header through the members module's published API.
 */
@RestController
public class MemberStatementController {

  private final LedgerQueryService service;
  private final CurrentUser currentUser;

  public MemberStatementController(LedgerQueryService service, CurrentUser currentUser) {
    this.service = service;
    this.currentUser = currentUser;
  }

  @GetMapping("/api/members/{id}/statement")
  public MemberStatementResponse statement(@PathVariable String id) {
    return service.statementFor(currentUser.require(), id);
  }
}
