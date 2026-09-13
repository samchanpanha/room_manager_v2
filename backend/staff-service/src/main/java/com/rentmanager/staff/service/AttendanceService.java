package com.rentmanager.staff.service;

import com.rentmanager.staff.domain.AttendanceRecord;
import com.rentmanager.staff.dto.AttendanceRecordDto;
import com.rentmanager.staff.dto.ClockInRequest;
import com.rentmanager.staff.dto.ClockOutRequest;
import com.rentmanager.staff.kafka.StaffOutboxService;
import com.rentmanager.staff.repository.AttendanceRecordRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AttendanceService {

    private final AttendanceRecordRepository attendanceRepository;
    private final StaffOutboxService outboxService;

    public AttendanceService(AttendanceRecordRepository attendanceRepository, StaffOutboxService outboxService) {
        this.attendanceRepository = attendanceRepository;
        this.outboxService = outboxService;
    }

    @Transactional(readOnly = true)
    public List<AttendanceRecordDto> getAttendanceByProperty(String propertyId) {
        return attendanceRepository.findByPropertyId(propertyId).stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public AttendanceRecordDto clockIn(ClockInRequest request) {
        String id = "att_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        Instant now = Instant.now();
        Instant workDate = now.truncatedTo(ChronoUnit.DAYS); // UTC midnight

        String source = request.source() != null ? request.source() : "mobile";

        AttendanceRecord record = new AttendanceRecord(id, request.userId(), request.propertyId(), workDate, now, source);
        record.setInLat(request.lat());
        record.setInLng(request.lng());
        record.setInGeoStatus(request.lat() != null ? "inside" : "unknown");

        AttendanceRecord saved = attendanceRepository.save(record);

        outboxService.publishEvent(
            "attendance.clock_in",
            saved.getPropertyId(),
            Map.of(
                "recordId", saved.getId(),
                "userId", saved.getUserId(),
                "clockInAt", saved.getClockInAt().toString()
            )
        );

        return toDto(saved);
    }

    @Transactional
    public AttendanceRecordDto clockOut(ClockOutRequest request) {
        AttendanceRecord record = attendanceRepository.findById(request.recordId())
            .orElseThrow(() -> new IllegalArgumentException("Attendance record not found: " + request.recordId()));

        Instant now = Instant.now();
        record.setClockOutAt(now);
        long minutes = ChronoUnit.MINUTES.between(record.getClockInAt(), now);
        record.setMinutesWorked((int) minutes);
        record.setUpdatedAt(now);

        AttendanceRecord saved = attendanceRepository.save(record);

        outboxService.publishEvent(
            "attendance.clock_out",
            saved.getPropertyId(),
            Map.of(
                "recordId", saved.getId(),
                "userId", saved.getUserId(),
                "minutesWorked", saved.getMinutesWorked()
            )
        );

        return toDto(saved);
    }

    private AttendanceRecordDto toDto(AttendanceRecord a) {
        return new AttendanceRecordDto(
            a.getId(),
            a.getUserId(),
            a.getPropertyId(),
            a.getWorkDate(),
            a.getClockInAt(),
            a.getClockOutAt(),
            a.getMinutesWorked(),
            a.getSource(),
            a.getCreatedAt()
        );
    }
}
