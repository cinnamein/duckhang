package oridungjeol.duckhang.chat.application.service;

import co.elastic.clients.util.Pair;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import oridungjeol.duckhang.chat.application.domain.FraudType;
import oridungjeol.duckhang.chat.application.domain.MessageType;
import oridungjeol.duckhang.chat.application.dto.Chat;
import oridungjeol.duckhang.chat.infrastructure.elasticsearch.document.ChatDocument;
import oridungjeol.duckhang.chat.infrastructure.elasticsearch.document.FraudDocument;
import oridungjeol.duckhang.chat.infrastructure.elasticsearch.repository.ChatESRepository;
import oridungjeol.duckhang.chat.infrastructure.elasticsearch.repository.ChatESRepositoryNative;
import oridungjeol.duckhang.chat.infrastructure.mapper.ChatMapper;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FraudDetectionService {

    private final ChatESRepositoryNative chatESRepositoryNative;
    private final ChatESRepository chatESRepository;
    private final ChatMapper chatMapper;
    private final SimpMessagingTemplate simpMessagingTemplate;
    private final Logger log = LoggerFactory.getLogger(this.getClass());

    @Async
    public void detectAsync(Chat message) {
        try {
            FraudType result = filterFraud(message.getContent());
            if (result != FraudType.NOT_FRAUD) {
                Chat warning = Chat.builder()
                        .type(MessageType.WARNNING)
                        .author_uuid(message.getAuthor_uuid())
                        .content(String.valueOf(result))
                        .created_at(LocalDateTime.now())
                        .room_id(message.getRoom_id())
                        .build();

                ChatDocument chatDocument = chatMapper.toChatDocument(warning);
                chatESRepository.save(chatDocument);

                String destination = "/topic/chat/" + message.getRoom_id();
                simpMessagingTemplate.convertAndSend(destination, warning);
            }
        } catch (Exception e) {
            log.error("비동기 사기 탐지 중 오류: {}", e.getMessage());
        }
    }

    private FraudType filterFraud(String content) throws Exception {
        List<Pair<FraudDocument, Float>> results = chatESRepositoryNative.searchFraud(content);

        float external_score = 0.0f;
        float deposit_score = 0.0f;
        float personal_score = 0.0f;

        for (Pair<FraudDocument, Float> pair : results) {
            FraudDocument fraudDocument = pair.key();
            Float score = pair.value();
            FraudType fraud_type = fraudDocument.getFraud_type();
            if (fraud_type == FraudType.EXTERNAL) external_score += score;
            else if (fraud_type == FraudType.DEPOSIT) deposit_score += score;
            else if (fraud_type == FraudType.PERSONAL_INFO) personal_score += score;
        }

        if (external_score > 5 && external_score > deposit_score && external_score > personal_score)
            return FraudType.EXTERNAL;
        else if (deposit_score > 5 && deposit_score >= external_score && deposit_score > personal_score)
            return FraudType.DEPOSIT;
        else if (personal_score > 5 && personal_score >= external_score && personal_score >= deposit_score)
            return FraudType.PERSONAL_INFO;

        return FraudType.NOT_FRAUD;
    }
}