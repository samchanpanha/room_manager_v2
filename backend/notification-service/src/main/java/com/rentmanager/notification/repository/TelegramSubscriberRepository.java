package com.rentmanager.notification.repository;

import com.rentmanager.notification.domain.TelegramSubscriber;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TelegramSubscriberRepository extends JpaRepository<TelegramSubscriber, String> {
    Optional<TelegramSubscriber> findByChatId(Long chatId);
    Optional<TelegramSubscriber> findByMemberProfileId(String memberProfileId);
}
