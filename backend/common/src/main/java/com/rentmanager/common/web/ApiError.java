package com.rentmanager.common.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.Map;

/**
 * Standard API error response envelope used by all RentManager services.
 *
 * <p>All services register a {@code GlobalExceptionHandler} that maps exceptions
 * to this structure so the API Gateway and clients get a consistent error format.
 *
 * <p>Example:
 * <pre>{@code
 * {
 *   "status": 422,
 *   "error": "VALIDATION_ERROR",
 *   "message": "Request validation failed",
 *   "timestamp": "2026-09-12T12:00:00Z",
 *   "path": "/api/billing/invoices",
 *   "correlationId": "req-abc123",
 *   "details": { "rentAmountMinor": "must be greater than 0" }
 * }
 * }</pre>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiError(
    int status,
    String error,
    String message,
    Instant timestamp,
    String path,
    String correlationId,
    Map<String, Object> details
) {

    // ── Factories ────────────────────────────────────────────────────────────

    public static ApiError of(int status, String error, String message, String path) {
        return new ApiError(status, error, message, Instant.now(), path, null, null);
    }

    public static ApiError of(int status, String error, String message, String path,
                               String correlationId) {
        return new ApiError(status, error, message, Instant.now(), path, correlationId, null);
    }

    public static ApiError validation(String path, Map<String, Object> fieldErrors) {
        return new ApiError(422, "VALIDATION_ERROR", "Request validation failed",
                Instant.now(), path, null, fieldErrors);
    }

    public static ApiError notFound(String path, String entityType, String id) {
        return new ApiError(404, "NOT_FOUND",
                entityType + " not found: " + id, Instant.now(), path, null, null);
    }

    public static ApiError forbidden(String path) {
        return new ApiError(403, "FORBIDDEN",
                "Insufficient permissions", Instant.now(), path, null, null);
    }

    public static ApiError conflict(String path, String message) {
        return new ApiError(409, "CONFLICT", message, Instant.now(), path, null, null);
    }
}
