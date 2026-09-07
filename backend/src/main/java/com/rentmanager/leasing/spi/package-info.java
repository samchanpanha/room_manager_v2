/**
 * Leasing SPI seams (INTENT.md M05/M10) exposed as a named interface so other
 * modules can implement them. The finance module implements
 * {@link com.rentmanager.leasing.spi.DepositBillingPort} to bill deposits at
 * lease activation. Referenced by dependents as {@code leasing::spi}.
 */
@org.springframework.modulith.NamedInterface("spi")
package com.rentmanager.leasing.spi;
