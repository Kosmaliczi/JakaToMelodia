package com.wolfship.melodia.core.service;

import com.wolfship.melodia.core.model.dto.GameStatusResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class GameEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public void publishStatus(GameStatusResponse status) {
        if (status == null) return;
        messagingTemplate.convertAndSend("/topic/games/" + status.gameId(), status);
    }
}
