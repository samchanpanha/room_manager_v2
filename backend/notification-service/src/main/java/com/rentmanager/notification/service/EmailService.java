package com.rentmanager.notification.service;

import com.rentmanager.notification.domain.NotificationLog;
import com.rentmanager.notification.repository.NotificationLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final NotificationLogRepository logRepository;
    private final JavaMailSender mailSender;

    public EmailService(NotificationLogRepository logRepository,
                        @Autowired(required = false) JavaMailSender mailSender) {
        this.logRepository = logRepository;
        this.mailSender = mailSender;
    }

    @Transactional
    public NotificationLog sendEmail(String to, String subject, String content) {
        String logId = "ntf_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String status = "sent";
        String errorMsg = null;

        if (mailSender != null) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(to);
                message.setSubject(subject != null ? subject : "RentManager Notification");
                message.setText(content);
                mailSender.send(message);
                log.info("Email sent successfully to {}", to);
            } catch (Exception e) {
                log.warn("Failed to send email to {}: {}", to, e.getMessage());
                status = "failed";
                errorMsg = e.getMessage();
            }
        } else {
            log.info("JavaMailSender not configured, logging email to {} with content: {}", to, content);
        }

        NotificationLog notificationLog = new NotificationLog(logId, to, "email", subject, content, status);
        notificationLog.setErrorMessage(errorMsg);
        return logRepository.save(notificationLog);
    }
}
