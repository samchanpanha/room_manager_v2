package com.rentmanager.notification.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rentmanager.common.event.EventEnvelope;
import com.rentmanager.common.event.RmTopics;
import com.rentmanager.notification.dto.SendNotificationRequest;
import com.rentmanager.notification.service.NotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@ConditionalOnProperty(name = "spring.kafka.bootstrap-servers")
public class DomainEventListener {

    private static final Logger log = LoggerFactory.getLogger(DomainEventListener.class);

    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;

    public DomainEventListener(NotificationService notificationService, ObjectMapper objectMapper) {
        this.notificationService = notificationService;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = {RmTopics.INVOICE_EVENTS, RmTopics.MEMBER_EVENTS, RmTopics.OPS_EVENTS}, groupId = "notification-service")
    public void onDomainEvent(String eventJson) {
        try {
            EventEnvelope<?> envelope = objectMapper.readValue(eventJson, EventEnvelope.class);
            log.info("NotificationService: Received event type '{}' for payload {}", envelope.type(), envelope.payload());

            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) envelope.payload();
            if (payload == null) return;

            if ("invoice.created".equals(envelope.type())) {
                String memberId = (String) payload.get("memberProfileId");
                String code = (String) payload.get("code");
                Object amount = payload.get("totalMinor");

                if (memberId != null) {
                    SendNotificationRequest req = new SendNotificationRequest();
                    req.setRecipient(memberId);
                    req.setChannel("email");
                    req.setSubject("New Rent Invoice Issued: " + code);
                    req.setContent("Dear Member, your invoice " + code + " for amount " + amount + " minor units is ready for payment.");
                    notificationService.sendNotification(req);
                }
            } else if ("payment.received".equals(envelope.type())) {
                String memberId = (String) payload.get("memberProfileId");
                String receipt = (String) payload.get("receiptCode");
                Object amount = payload.get("amountMinor");

                if (memberId != null) {
                    SendNotificationRequest req = new SendNotificationRequest();
                    req.setRecipient(memberId);
                    req.setChannel("telegram");
                    req.setSubject("Payment Received");
                    req.setContent("Payment received! Receipt " + receipt + " for amount " + amount + ". Thank you!");
                    notificationService.sendNotification(req);
                }
            } else if ("ticket.created".equals(envelope.type())) {
                String ticketId = (String) payload.get("ticketId");
                String title = (String) payload.get("title");
                SendNotificationRequest req = new SendNotificationRequest();
                req.setRecipient("STAFF");
                req.setChannel("in_app");
                req.setSubject("New Maintenance Ticket: " + title);
                req.setContent("Ticket ID " + ticketId + " has been logged: " + title);
                notificationService.sendNotification(req);
            }

        } catch (Exception e) {
            log.error("Failed to process domain event in NotificationService: {}", e.getMessage(), e);
        }
    }
}
