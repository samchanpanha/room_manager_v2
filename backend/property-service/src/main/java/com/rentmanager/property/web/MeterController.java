package com.rentmanager.property.web;

import com.rentmanager.property.domain.MeterReading;
import com.rentmanager.property.dto.MeterDto;
import com.rentmanager.property.dto.RecordMeterReadingRequest;
import com.rentmanager.property.service.MeterService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/meters")
public class MeterController {

    private final MeterService meterService;

    public MeterController(MeterService meterService) {
        this.meterService = meterService;
    }

    @GetMapping
    public ResponseEntity<List<MeterDto>> getMetersByRoom(@RequestParam String roomId) {
        return ResponseEntity.ok(meterService.getMetersByRoom(roomId));
    }

    @PostMapping("/readings")
    public ResponseEntity<MeterReading> recordReading(
            @RequestHeader(value = "X-Rm-User-Id", required = false) String userId,
            @Valid @RequestBody RecordMeterReadingRequest request) {
        MeterReading reading = meterService.recordReading(request, userId);
        return ResponseEntity.status(HttpStatus.CREATED).body(reading);
    }
}
