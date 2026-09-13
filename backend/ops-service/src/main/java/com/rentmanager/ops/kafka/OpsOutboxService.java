package com.rentmanager.ops.kafka;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class OpsOutboxService {

    private static final Logger log = LoggerFactory.getLogger(OpsOutboxService.class);

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public OpsOutboxService(JdbcTemplate jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void publishEvent(String type, String propertyId, Map<String, Object> payload) {
        String eventId = "evt_" + UUID.randomUUID().toString().replace("-", "");
        try {
            String jsonPayload = objectMapper.writeValueAsString(payload);
            jdbc.update(
                """
                INSERT INTO "DomainEvent" (id, type, payload, "propertyId", "occurredAt")
                VALUES (?, ?, ?, ?, ?)
                """,
                eventId, type, jsonPayload, propertyId, Instant.now()
            );
            log.info("Outbox: queued ops domain event {} ({})", type, eventId);
        } catch (Exception e) {
            log.error("Outbox: failed to queue ops event {}: {}", type, e.getMessage(), e);
            throw new RuntimeException("Failed to save domain event to outbox", e);
        }
    }
}
