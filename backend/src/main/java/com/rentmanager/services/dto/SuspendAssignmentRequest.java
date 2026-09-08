package com.rentmanager.services.dto;

import java.time.Instant;

/** Mirrors src/app/api/services/assignments/[id]/suspend/route.ts ({@code at} defaults to now). */
public record SuspendAssignmentRequest(Instant at) {}
