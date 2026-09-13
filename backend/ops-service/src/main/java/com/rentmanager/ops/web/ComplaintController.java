package com.rentmanager.ops.web;

import com.rentmanager.ops.dto.ComplaintDto;
import com.rentmanager.ops.dto.CreateComplaintRequest;
import com.rentmanager.ops.service.ComplaintService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/complaints")
public class ComplaintController {

    private final ComplaintService complaintService;

    public ComplaintController(ComplaintService complaintService) {
        this.complaintService = complaintService;
    }

    @GetMapping
    public ResponseEntity<List<ComplaintDto>> getComplaintsByProperty(@RequestParam String propertyId) {
        return ResponseEntity.ok(complaintService.getComplaintsByProperty(propertyId));
    }

    @PostMapping
    public ResponseEntity<ComplaintDto> createComplaint(@Valid @RequestBody CreateComplaintRequest request) {
        ComplaintDto created = complaintService.createComplaint(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }
}
