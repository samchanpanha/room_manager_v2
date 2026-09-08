/**
 * Billing SPI seams (INTENT.md M07/M09/M10) exposed as a named interface so
 * other modules can implement them (dependency inversion). The finance module
 * implements {@link com.rentmanager.billing.spi.DepositAdvancePort}; the future
 * ledger module implements {@link com.rentmanager.billing.spi.LedgerPostingPort}.
 * Referenced by dependents as {@code billing::spi}.
 */
@org.springframework.modulith.NamedInterface("spi")
package com.rentmanager.billing.spi;
