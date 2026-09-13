package com.rentmanager.ops.web;

import com.rentmanager.ops.domain.InspectionFinding;
import com.rentmanager.ops.repository.InspectionFindingRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/findings")
public class InspectionFindingController {

    private final InspectionFindingRepository findingRepository;

    public InspectionFindingController(InspectionFindingRepository findingRepository) {
        this.findingRepository = findingRepository;
    }

    @GetMapping
    public ResponseEntity<List<InspectionFinding>> getFindings(@RequestParam String inspectionId) {
        return ResponseEntity.ok(findingRepository.findByInspectionId(inspectionId));
    }
}
