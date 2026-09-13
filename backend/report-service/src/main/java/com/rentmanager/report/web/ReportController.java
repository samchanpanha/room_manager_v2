package com.rentmanager.report.web;

import com.rentmanager.report.dto.ArrearsReportDto;
import com.rentmanager.report.dto.OccupancyReportDto;
import com.rentmanager.report.dto.ProfitLossReportDto;
import com.rentmanager.report.dto.RevenueReportDto;
import com.rentmanager.report.service.ReportService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/occupancy")
    public ResponseEntity<OccupancyReportDto> getOccupancyReport(@RequestParam String propertyId) {
        return ResponseEntity.ok(reportService.getOccupancyReport(propertyId));
    }

    @GetMapping("/revenue")
    public ResponseEntity<RevenueReportDto> getRevenueReport(@RequestParam String propertyId) {
        return ResponseEntity.ok(reportService.getRevenueReport(propertyId));
    }

    @GetMapping("/profit-loss")
    public ResponseEntity<ProfitLossReportDto> getProfitLossReport(@RequestParam String propertyId) {
        return ResponseEntity.ok(reportService.getProfitLossReport(propertyId));
    }

    @GetMapping("/arrears")
    public ResponseEntity<List<ArrearsReportDto>> getArrearsReport(@RequestParam String propertyId) {
        return ResponseEntity.ok(reportService.getArrearsReport(propertyId));
    }
}
