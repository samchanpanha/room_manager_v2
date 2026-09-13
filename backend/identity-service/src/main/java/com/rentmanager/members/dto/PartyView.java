package com.rentmanager.members.dto;

/**
 * Plain party projection ({@code id, name, email, phone}) as nested in each
 * member row — same fields as the Next {@code party: {…}} include.
 */
public record PartyView(String id, String name, String email, String phone) {}