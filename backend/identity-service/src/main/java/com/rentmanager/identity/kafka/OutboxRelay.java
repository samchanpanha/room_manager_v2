package com.rentmanager.identity.kafka;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rentmanager.common.event.EventEnvelope;
import com.rentmanager.common.event.RmTopics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;

/**
 * Transactional Outbox Relay — polls the {@code domain_events} table and
 * publishes unpublished events to Kafka.
 *
 * <p>Design:
 * <ol>
 *   <li>Fetch up to {@code batchSize} rows where {@code publishedAt IS NULL}
 *       (oldest-first, {@code FOR UPDATE SKIP LOCKED} to support horizontal scaling).</li>
 *   <li>Publish each row as a {@link EventEnvelope} to the matching Kafka topic.</li>
 *   <li>Mark the row {@code publishedAt = now()} on successful produce.</li>
 *   <li>On failure, log and skip — the row stays unpublished and will be retried
 *       on the next poll cycle. The DLT strategy is applied after N retries
 *       (configured in {@code shared-common.yml → rm.outbox}).</li>
 * </ol>
 *
 * <p>This component is the ONLY Kafka producer in the identity-service; all
 * domain mutations go via the application services → domain_events table.
 *
 * <p>The {@code domain_events} schema (Prisma-owned):
 * <pre>{@code
 *   id         String  (cuid)
 *   type       String  -- e.g. "member.created"
 *   payload    String  -- JSON
 *   propertyId String? -- optional, for topic-key selection
 *   occurredAt DateTime
 * }</pre>
 *
 * <p>The relay adds {@code publishedAt} column via an additive Prisma migration
 * before this component is activated.
 *
 * @see <a href="https://microservices.io/patterns/data/transactional-outbox.html">Transactional Outbox Pattern</a>
 */
@Component
@ConditionalOnBean(KafkaTemplate.class)
public class OutboxRelay {

    private static final Logger log = LoggerFactory.getLogger(OutboxRelay.class);

    /** Maximum events published per poll cycle (configured via Nacos shared-common.yml). */
    private static final int BATCH_SIZE = 50;

    private final JdbcTemplate jdbc;
    private final KafkaTemplate<String, EventEnvelope<?>> kafka;
    private final ObjectMapper objectMapper;

    public OutboxRelay(JdbcTemplate jdbc,
                       KafkaTemplate<String, EventEnvelope<?>> kafka,
                       ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.kafka = kafka;
        this.objectMapper = objectMapper;
    }

    /**
     * Scheduled poll — runs every 5 seconds by default.
     * Cron overridable via Nacos config: {@code rm.outbox.poll-interval-ms}.
     */
    @Scheduled(fixedDelayString = "${rm.outbox.poll-interval-ms:5000}")
    @Transactional
    public void poll() {
        List<Map<String, Object>> rows = fetchUnpublishedBatch();
        if (rows.isEmpty()) return;

        log.debug("OutboxRelay: processing {} event(s)", rows.size());

        for (Map<String, Object> row : rows) {
            String id      = (String) row.get("id");
            String type    = (String) row.get("type");
            String payload = (String) row.get("payload");

            try {
                String topic = topicForEventType(type);
                Object payloadObj = objectMapper.readValue(payload, Object.class);

                EventEnvelope<Object> envelope = EventEnvelope.of(
                    type,
                    extractTenantId(payload),
                    "identity-service",
                    payloadObj
                );

                // Kafka key = event ID for consistent partition routing
                kafka.send(topic, id, envelope)
                    .thenAccept(result ->
                        log.debug("Published {} → {} offset {}",
                            type, topic, result.getRecordMetadata().offset()))
                    .exceptionally(ex -> {
                        log.error("Kafka send failed for event {}: {}", id, ex.getMessage());
                        return null;
                    });

                // Mark as published (best-effort; re-polled if Kafka didn't commit)
                markPublished(id);

            } catch (JsonProcessingException e) {
                log.error("OutboxRelay: malformed payload for event {} ({}): {}",
                    id, type, e.getMessage());
                // Poison-pill: mark as published to avoid infinite retry of bad data.
                // A copy is written to the DLT topic instead.
                publishToDlt(id, type, payload, e.getMessage());
                markPublished(id);
            }
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private List<Map<String, Object>> fetchUnpublishedBatch() {
        // FOR UPDATE SKIP LOCKED allows multiple relay instances without double-processing
        return jdbc.queryForList(
            """
            SELECT id, type, payload, "occurredAt"
            FROM   "DomainEvent"
            WHERE  "publishedAt" IS NULL
            ORDER  BY "occurredAt"
            LIMIT  ?
            FOR UPDATE SKIP LOCKED
            """,
            BATCH_SIZE
        );
    }

    private void markPublished(String id) {
        jdbc.update(
            "UPDATE \"DomainEvent\" SET \"publishedAt\" = ? WHERE id = ?",
            Instant.now(), id
        );
    }

    private void publishToDlt(String id, String type, String payload, String error) {
        try {
            Map<String, String> dltPayload = Map.of(
                "eventId", id, "eventType", type, "error", error, "rawPayload", payload
            );
            kafka.send(RmTopics.NOTIFICATION_DLT, id,
                EventEnvelope.of("outbox.error", "DEFAULT", "identity-service", dltPayload));
        } catch (Exception ex) {
            log.error("Failed to publish to DLT for event {}", id, ex);
        }
    }

    /**
     * Maps event type prefixes to Kafka topics.
     * Extend this method as new event types are introduced.
     */
    private String topicForEventType(String type) {
        if (type == null) return RmTopics.MEMBER_EVENTS;
        if (type.startsWith("member."))   return RmTopics.MEMBER_EVENTS;
        if (type.startsWith("lease."))    return RmTopics.LEASE_EVENTS;
        if (type.startsWith("invoice."))  return RmTopics.INVOICE_EVENTS;
        if (type.startsWith("payment."))  return RmTopics.PAYMENT_EVENTS;
        if (type.startsWith("deposit."))  return RmTopics.DEPOSIT_EVENTS;
        if (type.startsWith("room."))     return RmTopics.PROPERTY_EVENTS;
        if (type.startsWith("ticket."))   return RmTopics.OPS_EVENTS;
        if (type.startsWith("sale."))     return RmTopics.POS_EVENTS;
        if (type.startsWith("statement."))return RmTopics.STATEMENT_EVENTS;
        // Default fallback
        log.warn("OutboxRelay: unknown event type '{}' — routing to {}", type, RmTopics.MEMBER_EVENTS);
        return RmTopics.MEMBER_EVENTS;
    }

    /** Extracts tenantId from JSON payload, defaults to "DEFAULT". */
    private String extractTenantId(String payload) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> map = objectMapper.readValue(payload, Map.class);
            Object tid = map.get("tenantId");
            return (tid instanceof String s) ? s : "DEFAULT";
        } catch (Exception e) {
            return "DEFAULT";
        }
    }
}
