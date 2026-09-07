package com.rentmanager.finance.spi;

import com.rentmanager.billing.spi.DepositAdvancePort;
import com.rentmanager.finance.service.DepositAppService;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/**
 * Finance's implementation of the billing {@link DepositAdvancePort} (M10):
 * confirming a payment on a deposit invoice advances the deposit (billed → held)
 * here. Registering this bean replaces billing's no-op default.
 */
@Component
@Primary
public class DepositAdvanceAdapter implements DepositAdvancePort {

  private final DepositAppService deposits;

  public DepositAdvanceAdapter(DepositAppService deposits) {
    this.deposits = deposits;
  }

  @Override
  public void onDepositInvoicePaid(String invoiceId) {
    deposits.onDepositInvoicePaid(invoiceId);
  }
}
