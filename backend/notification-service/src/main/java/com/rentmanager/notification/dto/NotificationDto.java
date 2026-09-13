package com.rentmanager.notification.dto;

import com.rentmanager.notification.domain.NotificationLog;

import java.time.Instant;

public class NotificationDto {
    private String id;
    private String recipient;
    private String channel;
    private String subject;
    private String content;
    private String status;
    private String errorMessage;
    private Instant sentAt;
    private Instant createdAt;

    public NotificationDto() {}

    public NotificationDto(NotificationLog log) {
        this.id = log.getId();
        this.recipient = log.getRecipient();
        this.channel = log.getChannel();
        this.subject = log.getSubject();
        this.content = log.getContent();
        this.status = log.getStatus();
        this.errorMessage = log.getErrorMessage();
        this.sentAt = log.getSentAt();
        this.createdAt = log.getCreatedAt();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getRecipient() { return recipient; }
    public void setRecipient(String recipient) { this.recipient = recipient; }
    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }
    public Instant getSentAt() { return sentAt; }
    public void setSentAt(Instant sentAt) { this.sentAt = sentAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
