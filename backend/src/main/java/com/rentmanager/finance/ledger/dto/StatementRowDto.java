package com.rentmanager.finance.ledger.dto;

import java.time.Instant;
import java.util.List;

/** One member-statement row with the running receivable balance (M08). */
public record StatementRowDto(String id, Instant postedAt, String memo, String refType, String refId,
    boolean isReversal, int totalMinor, long receivableAfter, List<JournalEntryDto> entries) {}
