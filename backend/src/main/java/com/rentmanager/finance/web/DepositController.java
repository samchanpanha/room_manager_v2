package com.rentmanager.finance.web;

import com.rentmanager.finance.dto.DeductRequest;
import com.rentmanager.finance.dto.DepositDetail;
import com.rentmanager.finance.dto.DepositSummary;
import com.rentmanager.finance.dto.RefundRequest;
import com.rentmanager.finance.dto.SettlementResult;
import com.rentmanager.finance.service.DepositAppService;
import com.rentmanager.platform.security.CurrentUser;
import java.util.List;
import org.springframework.web.bind.annotation.*;

/**
 * REST for M10, mirroring {@code src/app/api/deposits/*}: list, get detail, and
 * the settlement movements deduct / refund. Deposits are created + billed
 * automatically at lease activation (via the DepositBillingPort), so there is no
 * manual create endpoint — parity with the Next app.
 */
@RestController
@RequestMapping("/api/deposits")
public class DepositController {

  private final DepositAppService service;
  private final CurrentUser currentUser;

  public DepositController(DepositAppService service, CurrentUser currentUser) {
    this.service = service;
    this.currentUser = currentUser;
  }

  @GetMapping
  public List<DepositSummary> list(@RequestParam(required = false) String status) {
    return service.list(currentUser.require(), status);
  }

  @GetMapping("/{id}")
  public DepositDetail get(@PathVariable String id) {
    return service.get(currentUser.require(), id);
  }

  @PostMapping("/{id}/deduct")
  public SettlementResult deduct(@PathVariable String id, @RequestBody DeductRequest body) {
    return service.deduct(currentUser.require(), id, body);
  }

  @PostMapping("/{id}/refund")
  public SettlementResult refund(@PathVariable String id, @RequestBody RefundRequest body) {
    return service.refund(currentUser.require(), id, body);
  }
}
