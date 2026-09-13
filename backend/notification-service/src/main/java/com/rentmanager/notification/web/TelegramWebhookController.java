package com.rentmanager.notification.web;

import com.rentmanager.notification.service.TelegramService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/telegram/webhook")
public class TelegramWebhookController {

    private final TelegramService telegramService;

    public TelegramWebhookController(TelegramService telegramService) {
        this.telegramService = telegramService;
    }

    @PostMapping
    public ResponseEntity<String> handleWebhookUpdate(@RequestBody Map<String, Object> update) {
        try {
            if (update.containsKey("message")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> message = (Map<String, Object>) update.get("message");
                @SuppressWarnings("unchecked")
                Map<String, Object> chat = (Map<String, Object>) message.get("chat");
                Long chatId = ((Number) chat.get("id")).longValue();
                String text = (String) message.get("text");

                String username = null;
                if (message.containsKey("from")) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> from = (Map<String, Object>) message.get("from");
                    username = (String) from.get("username");
                }

                String reply = telegramService.handleWebhookCommand(chatId, text, username);
                return ResponseEntity.ok(reply);
            }
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Error processing Telegram update: " + e.getMessage());
        }
        return ResponseEntity.ok("OK");
    }
}
