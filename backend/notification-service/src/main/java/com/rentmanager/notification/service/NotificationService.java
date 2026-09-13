package com.rentmanager.notification.service;

import com.rentmanager.notification.domain.NotificationLog;
import com.rentmanager.notification.dto.NotificationDto;
import com.rentmanager.notification.dto.SendNotificationRequest;
import com.rentmanager.notification.repository.NotificationLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class NotificationService {

    private final NotificationLogRepository logRepository;
    private final EmailService emailService;
    private final TelegramService telegramService;

    public NotificationService(NotificationLogRepository logRepository,
                                EmailService emailService,
                                TelegramService telegramService) {
        this.logRepository = logRepository;
        this.emailService = emailService;
        this.telegramService = telegramService;
    }

    @Transactional
    public NotificationDto sendNotification(SendNotificationRequest request) {
        NotificationLog log;
        if ("email".equalsIgnoreCase(request.getChannel())) {
            log = emailService.sendEmail(request.getRecipient(), request.getSubject(), request.getContent());
        } else if ("telegram".equalsIgnoreCase(request.getChannel())) {
            log = telegramService.sendTelegramMessage(request.getRecipient(), request.getContent());
        } else {
            // in_app or fallback
            String logId = "ntf_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
            log = new NotificationLog(logId, request.getRecipient(), request.getChannel(), request.getSubject(), request.getContent(), "sent");
            log = logRepository.save(log);
        }
        return new NotificationDto(log);
    }

    @Transactional(readOnly = true)
    public List<NotificationDto> getNotificationsByRecipient(String recipient) {
        return logRepository.findByRecipient(recipient).stream()
            .map(NotificationDto::new)
            .toList();
    }
}
