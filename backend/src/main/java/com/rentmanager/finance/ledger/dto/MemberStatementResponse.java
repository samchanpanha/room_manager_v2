package com.rentmanager.finance.ledger.dto;

import java.util.List;

/**
 * Member account statement response (M08) matching the Next
 * {@code /api/members/[id]/statement} body: a member header plus the running
 * receivable rows.
 */
public record MemberStatementResponse(MemberHeader member, List<StatementRowDto> rows,
    long receivableMinor) {

  public record MemberHeader(String id, String name) {}

  public static MemberStatementResponse of(String id, String name, MemberStatement statement) {
    return new MemberStatementResponse(new MemberHeader(id, name), statement.rows(),
        statement.receivableMinor());
  }
}
