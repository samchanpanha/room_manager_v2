package com.rentmanager.properties.dto;

import jakarta.validation.constraints.NotBlank;

public record RoomStatusRequest(@NotBlank String status) {}
