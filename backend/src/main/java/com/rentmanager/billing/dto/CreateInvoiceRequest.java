package com.rentmanager.billing.dto;

import java.util.List;

/**
 * Manual draft-invoice creation (M07). Amounts are major-unit doubles here and
 * converted to integer minor units in the service, matching the Next API.
 */
public record CreateInvoiceRequest(
    String propertyId,
    String memberProfileId,
    String leaseId,
    String periodStart,
    String periodEnd,
    String dueDate,
    Double discount,
    Double tax,
    Boolean isDeposit,
    String notes,
    List<CreateInvoiceItemInput> items) {}
