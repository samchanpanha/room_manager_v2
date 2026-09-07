package com.rentmanager.billing.web;

import com.rentmanager.billing.service.RentEngineService;
import com.rentmanager.billing.service.RentEngineService.DunningResult;
import com.rentmanager.billing.service.RentEngineService.LateFeeResult;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.platform.security.Rbdc;
import com.rentmanager.platform.web.ApiException;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Daily billing job (INTENT.md M06/M07), mounted at the Next handler's path
 * ({@code /api/jobs/billing-daily}): auto-apply late fees past the grace period,
 * then mark invoices overdue and advance the dunning ladder. Gate: M06:update
 * (rent-engine operators).
 */
@RestController
@RequestMapping("/api/jobs/billing-daily")
public class BillingDailyController {

  private final RentEngineService service;
  private final CurrentUser currentUser;

  public BillingDailyController(RentEngineService service, CurrentUser currentUser) {
    this.service = service;
    this.currentUser = currentUser;
  }

  @PostMapping
  public Map<String, Object> run() {
    AuthPrincipal user = currentUser.require();
    if (!Rbdc.hasModuleAccess(user, "update", "M06")) {
      throw ApiException.forbidden("M06", "update");
    }
    LateFeeResult lateFees = service.applyLateFees(user.id(), user.name());
    DunningResult dunning = service.runDunning(user.id(), user.name());
    return Map.of("lateFees", lateFees, "dunning", dunning);
  }
}
