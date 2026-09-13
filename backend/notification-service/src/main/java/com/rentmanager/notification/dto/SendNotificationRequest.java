package com.rentmanager.notification.dto;

import jakarta.validation.constraints.NotBlank;

public class SendNotificationRequest {
    @NotBlank
    private String recipient;

    @NotBlank
    private String channel; // email | telegram | in_app

    private String subject;

    @NotBlank
    private String content;

    public SendNotificationRequest() {}

    public String getRecipient() { return recipient; }
    public void setRecipient(String recipient) { this.recipient = recipient; }

    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
}
