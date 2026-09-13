package com.rentmanager.common.event;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import java.time.Instant;
import java.util.UUID;

/**
 * Standard Kafka event envelope for all RentManager domain events.
 *
 * <p>All Kafka producers wrap their payloads in this envelope so consumers have
 * a consistent metadata contract regardless of which service produced the event.
 *
 * <p>Example JSON:
 * <pre>{@code
 * {
 *   "id": "01HXZ...",
 *   "type": "lease.activated",
 *   "tenantId": "DEFAULT",
 *   "correlationId": "req-abc123",
 *   "occurredAt": "2026-09-12T12:00:00Z",
 *   "source": "billing-service",
 *   "payload": { ... }
 * }
 * }</pre>
 *
 * @param <T> the type of the domain-event payload
 */
public record EventEnvelope<T>(
    /** Globally unique event ID (UUID v4). Consumers use this for idempotency checks. */
    String id,

    /**
     * Dot-separated event type. Convention: {@code <aggregate>.<past-tense-verb>}
     * Examples: {@code lease.activated}, {@code payment.confirmed}, {@code room.status_changed}.
     */
    String type,

    /** Multi-tenant ID — matches {@code Tenant.id} in the shared schema. */
    String tenantId,

    /**
     * Propagated request/trace correlation ID from the originating HTTP request header
     * {@code X-Correlation-Id}. May be null for batch/scheduled events.
     */
    String correlationId,

    /** Wall-clock time the domain event occurred (UTC). */
    Instant occurredAt,

    /** Logical service name of the producer (e.g. "billing-service"). */
    String source,

    /** The domain event payload. Serialised as a nested JSON object. */
    @JsonTypeInfo(use = JsonTypeInfo.Id.NONE)
    T payload
) {

    /**
     * Convenience factory — generates a new ID and sets {@code occurredAt} to now.
     *
     * @param type    event type string
     * @param tenantId tenant identifier
     * @param source  producing service name
     * @param payload the domain payload
     * @param <T>     payload type
     * @return a fully populated envelope
     */
    public static <T> EventEnvelope<T> of(String type, String tenantId, String source, T payload) {
        return new EventEnvelope<>(
            UUID.randomUUID().toString(),
            type,
            tenantId,
            null,
            Instant.now(),
            source,
            payload
        );
    }

    /**
     * Convenience factory with correlation ID (copy from inbound HTTP request).
     */
    public static <T> EventEnvelope<T> of(
        String type, String tenantId, String correlationId, String source, T payload
    ) {
        return new EventEnvelope<>(
            UUID.randomUUID().toString(),
            type,
            tenantId,
            correlationId,
            Instant.now(),
            source,
            payload
        );
    }
}
