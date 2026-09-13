package com.rentmanager.notification.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"TelegramSubscriber\"")
public class TelegramSubscriber {

    @Id
    private String id;

    @Column(name = "\"chatId\"", nullable = false, unique = true)
    private Long chatId;

    @Column(name = "\"memberProfileId\"")
    private String memberProfileId;

    @Column(name = "\"username\"")
    private String username;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    public TelegramSubscriber() {}

    public TelegramSubscriber(String id, Long chatId, String memberProfileId, String username) {
        this.id = id;
        this.chatId = chatId;
        this.memberProfileId = memberProfileId;
        this.username = username;
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public Long getChatId() { return chatId; }
    public void setChatId(Long chatId) { this.chatId = chatId; }

    public String getMemberProfileId() { return memberProfileId; }
    public void setMemberProfileId(String memberProfileId) { this.memberProfileId = memberProfileId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
