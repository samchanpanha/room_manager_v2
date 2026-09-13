package com.rentmanager.report.web;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/export")
public class ExportController {

    @GetMapping("/{entity}")
    public ResponseEntity<String> exportEntity(@PathVariable String entity, @RequestParam(required = false) String propertyId) {
        String csvData = "id,entity,propertyId\n1," + entity + "," + (propertyId != null ? propertyId : "ALL");
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + entity + "_export.csv")
            .contentType(MediaType.parseMediaType("text/csv"))
            .body(csvData);
    }
}
