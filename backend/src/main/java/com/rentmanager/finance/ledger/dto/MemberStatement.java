package com.rentmanager.finance.ledger.dto;

import java.util.List;

/** Member account statement (M08). */
public record MemberStatement(List<StatementRowDto> rows, long receivableMinor) {}
