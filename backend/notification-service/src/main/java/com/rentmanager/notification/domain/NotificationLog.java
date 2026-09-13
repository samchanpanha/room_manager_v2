package com.rentmanager.notification.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"NotificationLog\"")
public class NotificationLog {

    @Id
    private String id;

    @Column(name = "recipient", nullable = false)
    private String recipient;

    @Column(name = "channel", nullable = false)
    private String channel; // email | telegram | push | in_app

    @Column(name = "subject")
    private String subject;

    @Column(name = "content", nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(name = "status", nullable = false)
    private String status = "sent"; // pending | sent | failed

    @Column(name = "\"errorMessage\"")
    private String errorMessage;

    @Column(name = "\"sentAt\"")
    private Instant sentAt;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    public NotificationLog() {}

    public NotificationLog(String id, String recipient, String channel, String subject, String content, String status) {
        this.id = id;
        this.recipient = recipient;
        this.channel = channel;
        this.subject = subject;
        this.content = content;
        this.status = status;
        this.sentAt = "sent".equals(status) ? Instant.now() : null;
        this.createdAt = Instant.now();
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
