package com.rentmanager.members.dto;

import java.util.List;

/**
 * One member row in the list response, mirroring the exact field set the Next
 * handler maps ({@code id, partyId, status, homePropertyId, propertyCode,
 * party, leases}).
 */
public record MemberRow(
    String id,
    String partyId,
    String status,
    String homePropertyId,
    String propertyCode,
    PartyView party,
    List<LeaseRow> leases) {}