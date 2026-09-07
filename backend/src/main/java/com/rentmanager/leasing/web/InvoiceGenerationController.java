package com.rentmanager.leasing.web;

import com.rentmanager.leasing.service.InvoiceGenerationService;
import com.rentmanager.leasing.service.InvoiceGenerationService.GenerationSummary;
import com.rentmanager.platform.security.CurrentUser;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Monthly invoice generation job trigger (INTENT.md M06/M07), mounted at the
 * same path as the Next handler ({@code /api/jobs/invoice-generation}) so the
 * frontend proxy switch is a no-op. Gate + property scoping live in the service.
 */
@RestController
@RequestMapping("/api/jobs/invoice-generation")
public class InvoiceGenerationController {

  private final InvoiceGenerationService service;
  private final CurrentUser currentUser;

  public InvoiceGenerationController(InvoiceGenerationService service, CurrentUser currentUser) {
    this.service = service;
    this.currentUser = currentUser;
  }

  @PostMapping
  public GenerationSummary run() {
    return service.generate(currentUser.require());
  }
}
