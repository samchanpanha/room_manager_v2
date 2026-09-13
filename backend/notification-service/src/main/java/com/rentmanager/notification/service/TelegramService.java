package com.rentmanager.notification.service;

import com.rentmanager.notification.domain.NotificationLog;
import com.rentmanager.notification.domain.TelegramSubscriber;
import com.rentmanager.notification.repository.NotificationLogRepository;
import com.rentmanager.notification.repository.TelegramSubscriberRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
public class TelegramService {

    private static final Logger log = LoggerFactory.getLogger(TelegramService.class);

    private final NotificationLogRepository logRepository;
    private final TelegramSubscriberRepository subscriberRepository;

    @Value("${telegram.bot-username:RentManagerBot}")
    private String botUsername;

    public TelegramService(NotificationLogRepository logRepository,
                           TelegramSubscriberRepository subscriberRepository) {
        this.logRepository = logRepository;
        this.subscriberRepository = subscriberRepository;
    }

    @Transactional
    public NotificationLog sendTelegramMessage(String recipient, String content) {
        String logId = "ntf_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        
        // Find subscriber by memberProfileId or chatId
        Long chatId = null;
        try {
            chatId = Long.parseLong(recipient);
        } catch (NumberFormatException e) {
            Optional<TelegramSubscriber> sub = subscriberRepository.findByMemberProfileId(recipient);
            if (sub.isPresent()) {
                chatId = sub.get().getChatId();
            }
        }

        String status = "sent";
        String errorMsg = null;

        if (chatId != null) {
            log.info("Sending Telegram message to chatId {} (recipient: {}): {}", chatId, recipient, content);
        } else {
            log.warn("Telegram subscriber not found for recipient: {}, message logged as pending/failed", recipient);
            status = "failed";
            errorMsg = "Subscriber not registered for recipient: " + recipient;
        }

        NotificationLog notificationLog = new NotificationLog(logId, recipient, "telegram", "Telegram Notification", content, status);
        notificationLog.setErrorMessage(errorMsg);
        return logRepository.save(notificationLog);
    }

    @Transactional
    public TelegramSubscriber registerSubscriber(Long chatId, String memberProfileId, String username) {
        String id = "tgsub_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        TelegramSubscriber subscriber = subscriberRepository.findByChatId(chatId)
            .orElseGet(() -> new TelegramSubscriber(id, chatId, memberProfileId, username));
        
        subscriber.setMemberProfileId(memberProfileId);
        subscriber.setUsername(username);
        return subscriberRepository.save(subscriber);
    }

    @Transactional
    public String handleWebhookCommand(Long chatId, String text, String username) {
        if (text == null) return "OK";

        if (text.startsWith("/start")) {
            String[] parts = text.split(" ");
            if (parts.length > 1) {
                String memberProfileId = parts[1];
                registerSubscriber(chatId, memberProfileId, username);
                return "Welcome! Your Telegram account has been linked to RentManager profile " + memberProfileId;
            }
            return "Welcome to RentManager Bot! To link your account, use command: /register <your_member_id>";
        } else if (text.startsWith("/register")) {
            String[] parts = text.split(" ");
            if (parts.length > 1) {
                String memberProfileId = parts[1];
                registerSubscriber(chatId, memberProfileId, username);
                return "Successfully linked to RentManager profile: " + memberProfileId;
            }
            return "Usage: /register <member_profile_id>";
        }

        return "Command not recognized. Type /start or /register <member_id>";
    }
}
