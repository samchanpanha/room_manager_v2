package com.rentmanager.notification.repository;

import com.rentmanager.notification.domain.NotificationLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationLogRepository extends JpaRepository<NotificationLog, String> {
    List<NotificationLog> findByRecipient(String recipient);
    List<NotificationLog> findByChannel(String channel);
}
