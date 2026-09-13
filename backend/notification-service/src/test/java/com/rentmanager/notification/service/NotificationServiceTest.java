package com.rentmanager.notification.service;

import com.rentmanager.notification.domain.NotificationLog;
import com.rentmanager.notification.dto.NotificationDto;
import com.rentmanager.notification.dto.SendNotificationRequest;
import com.rentmanager.notification.repository.NotificationLogRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationLogRepository logRepository;

    @Mock
    private EmailService emailService;

    @Mock
    private TelegramService telegramService;

    @InjectMocks
    private NotificationService notificationService;

    @Test
    @DisplayName("sendNotification dispatches email when channel is email")
    void sendNotification_email() {
        SendNotificationRequest req = new SendNotificationRequest();
        req.setRecipient("tenant@example.com");
        req.setChannel("email");
        req.setSubject("Rent Receipt");
        req.setContent("Payment received. Thank you!");

        NotificationLog mockLog = new NotificationLog("ntf_123", "tenant@example.com", "email", "Rent Receipt", "Payment received. Thank you!", "sent");
        when(emailService.sendEmail(eq("tenant@example.com"), eq("Rent Receipt"), anyString())).thenReturn(mockLog);

        NotificationDto result = notificationService.sendNotification(req);

        assertThat(result).isNotNull();
        assertThat(result.getRecipient()).isEqualTo("tenant@example.com");
        assertThat(result.getChannel()).isEqualTo("email");
        verify(emailService).sendEmail(eq("tenant@example.com"), eq("Rent Receipt"), anyString());
    }

    @Test
    @DisplayName("getNotificationsByRecipient retrieves notification log history")
    void getNotificationsByRecipient_success() {
        NotificationLog mockLog = new NotificationLog("ntf_123", "tenant@example.com", "email", "Rent Receipt", "Payment received. Thank you!", "sent");
        when(logRepository.findByRecipient("tenant@example.com")).thenReturn(List.of(mockLog));

        List<NotificationDto> results = notificationService.getNotificationsByRecipient("tenant@example.com");

        assertThat(results).hasSize(1);
        assertThat(results.get(0).getRecipient()).isEqualTo("tenant@example.com");
    }
}
