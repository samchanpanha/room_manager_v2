package com.rentmanager.members.dto;

/**
 * The single active/draft lease shown under a member row
 * ({@code id, code, status, room}).
 */
public record LeaseRow(String id, String code, String status, RoomView room) {}