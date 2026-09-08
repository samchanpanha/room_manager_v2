package com.rentmanager.finance.spi;

import com.rentmanager.finance.service.DepositAppService;
import com.rentmanager.leasing.spi.DepositBillingPort;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

/**
 * Finance's implementation of the leasing {@link DepositBillingPort} (M10):
 * lease activation bills the deposit here. Registering this bean replaces
 * leasing's no-op default (dependency inversion — leasing never imports finance).
 */
@Component
@Primary
public class DepositBillingAdapter implements DepositBillingPort {

  private final DepositAppService deposits;

  public DepositBillingAdapter(DepositAppService deposits) {
    this.deposits = deposits;
  }

  @Override
  public DepositBilled ensureDepositForLease(String leaseId) {
    DepositAppService.EnsureResult r = deposits.ensureForLease(leaseId, null);
    if (r == null) return null;
    return new DepositBilled(r.created(), r.invoiceId());
  }
}
