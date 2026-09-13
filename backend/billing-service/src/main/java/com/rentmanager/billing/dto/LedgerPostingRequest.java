package com.rentmanager.billing.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record LedgerPostingRequest(
    @NotBlank String memo,
    @NotBlank String refType,
    String refId,
    String propertyId,
    String memberId,
    @NotEmpty List<EntryRequest> entries
) {
    public record EntryRequest(
        @NotBlank String accountCode,
        int debit,
        int credit,
        String memo
    ) {}
}
