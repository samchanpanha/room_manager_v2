package com.rentmanager.property.service;

import com.rentmanager.property.domain.Meter;
import com.rentmanager.property.domain.MeterReading;
import com.rentmanager.property.dto.MeterDto;
import com.rentmanager.property.dto.RecordMeterReadingRequest;
import com.rentmanager.property.kafka.PropertyOutboxService;
import com.rentmanager.property.repository.MeterReadingRepository;
import com.rentmanager.property.repository.MeterRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class MeterService {

    private final MeterRepository meterRepository;
    private final MeterReadingRepository readingRepository;
    private final PropertyOutboxService outboxService;

    public MeterService(MeterRepository meterRepository,
                        MeterReadingRepository readingRepository,
                        PropertyOutboxService outboxService) {
        this.meterRepository = meterRepository;
        this.readingRepository = readingRepository;
        this.outboxService = outboxService;
    }

    @Transactional(readOnly = true)
    public List<MeterDto> getMetersByRoom(String roomId) {
        return meterRepository.findByRoomId(roomId).stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public MeterReading recordReading(RecordMeterReadingRequest request, String createdById) {
        Meter meter = meterRepository.findById(request.meterId())
            .orElseThrow(() -> new IllegalArgumentException("Meter not found with id: " + request.meterId()));

        String readingId = "mr_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        Instant readAt = request.readAt() != null ? request.readAt() : Instant.now();

        MeterReading reading = new MeterReading(readingId, meter.getId(), request.valueMilli(), readAt, "manual");
        reading.setEstimated(request.estimated());
        reading.setNote(request.note());
        reading.setCreatedById(createdById);

        MeterReading saved = readingRepository.save(reading);

        outboxService.publishEvent(
            "meter.reading_recorded",
            null,
            Map.of(
                "readingId", saved.getId(),
                "meterId", meter.getId(),
                "code", meter.getCode(),
                "type", meter.getType(),
                "valueMilli", saved.getValueMilli(),
                "readAt", saved.getReadAt().toString()
            )
        );

        return saved;
    }

    private MeterDto toDto(Meter m) {
        return new MeterDto(
            m.getId(),
            m.getCode(),
            m.getType(),
            m.getUnitLabel(),
            m.getRoomId(),
            m.isActive(),
            m.getCreatedAt()
        );
    }
}
