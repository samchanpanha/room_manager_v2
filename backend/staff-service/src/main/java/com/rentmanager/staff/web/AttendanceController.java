package com.rentmanager.staff.web;

import com.rentmanager.staff.dto.AttendanceRecordDto;
import com.rentmanager.staff.dto.ClockInRequest;
import com.rentmanager.staff.dto.ClockOutRequest;
import com.rentmanager.staff.service.AttendanceService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    private final AttendanceService attendanceService;

    public AttendanceController(AttendanceService attendanceService) {
        this.attendanceService = attendanceService;
    }

    @GetMapping
    public ResponseEntity<List<AttendanceRecordDto>> getAttendanceByProperty(@RequestParam String propertyId) {
        return ResponseEntity.ok(attendanceService.getAttendanceByProperty(propertyId));
    }

    @PostMapping("/clock-in")
    public ResponseEntity<AttendanceRecordDto> clockIn(@Valid @RequestBody ClockInRequest request) {
        AttendanceRecordDto record = attendanceService.clockIn(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(record);
    }

    @PostMapping("/clock-out")
    public ResponseEntity<AttendanceRecordDto> clockOut(@Valid @RequestBody ClockOutRequest request) {
        return ResponseEntity.ok(attendanceService.clockOut(request));
    }
}
