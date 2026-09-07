package com.rentmanager.finance.ledger.dto;

import java.time.Instant;
import java.util.List;

/** A journal transaction with its entry lines (M08). */
public record JournalTxnDto(String id, Instant postedAt, String memo, String refType, String refId,
    String propertyId, String memberId, boolean isReversal, int totalMinor,
    List<JournalEntryDto> entries) {}
