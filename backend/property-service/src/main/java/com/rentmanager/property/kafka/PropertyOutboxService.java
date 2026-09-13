package com.rentmanager.property.kafka;

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
public class PropertyOutboxService {

    private static final Logger log = LoggerFactory.getLogger(PropertyOutboxService.class);

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public PropertyOutboxService(JdbcTemplate jdbc, ObjectMapper objectMapper) {
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
            log.info("Outbox: queued domain event {} ({}) for property {}", type, eventId, propertyId);
        } catch (Exception e) {
            log.error("Outbox: failed to queue event {} for property {}: {}", type, propertyId, e.getMessage(), e);
            throw new RuntimeException("Failed to save domain event to outbox", e);
        }
    }
}
