package com.rentmanager.property.web;

import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/stay", "/api/stays"})
public class StayController {

    private final JdbcTemplate jdbc;

    public StayController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping("/bookings")
    public ResponseEntity<List<Map<String, Object>>> getBookings(@RequestParam(required = false) String propertyId) {
        String sql = "SELECT id, \"propertyId\", \"roomId\", \"guestName\", status, \"checkIn\", \"checkOut\" FROM \"StayBooking\"";
        if (propertyId != null && !propertyId.isBlank()) {
            sql += " WHERE \"propertyId\" = ?";
            return ResponseEntity.ok(jdbc.queryForList(sql, propertyId));
        }
        return ResponseEntity.ok(jdbc.queryForList(sql));
    }
}
