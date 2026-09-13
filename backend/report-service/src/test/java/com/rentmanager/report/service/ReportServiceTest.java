package com.rentmanager.report.service;

import com.rentmanager.report.dto.ArrearsReportDto;
import com.rentmanager.report.dto.OccupancyReportDto;
import com.rentmanager.report.dto.ProfitLossReportDto;
import com.rentmanager.report.dto.RevenueReportDto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("unchecked")
class ReportServiceTest {

    @Mock
    private JdbcTemplate jdbc;

    @InjectMocks
    private ReportService reportService;

    private String propertyId = "prop_123";

    @Test
    @DisplayName("getOccupancyReport executes aggregate query and returns OccupancyReportDto")
    void getOccupancyReport_success() {
        OccupancyReportDto mockDto = new OccupancyReportDto(propertyId, 10, 8, 2, 0);
        when(jdbc.queryForObject(any(String.class), any(RowMapper.class), eq(propertyId))).thenReturn(mockDto);

        OccupancyReportDto report = reportService.getOccupancyReport(propertyId);

        assertThat(report).isNotNull();
        assertThat(report.getTotalRooms()).isEqualTo(10);
        assertThat(report.getOccupiedRooms()).isEqualTo(8);
        assertThat(report.getVacantRooms()).isEqualTo(2);
        assertThat(report.getOccupancyRate()).isEqualTo(80.0);
    }

    @Test
    @DisplayName("getRevenueReport aggregates invoiced, collected, and outstanding amounts")
    void getRevenueReport_success() {
        RevenueReportDto mockDto = new RevenueReportDto(propertyId, 100000, 80000, 20000);
        when(jdbc.queryForObject(any(String.class), any(RowMapper.class), eq(propertyId))).thenReturn(mockDto);

        RevenueReportDto report = reportService.getRevenueReport(propertyId);

        assertThat(report).isNotNull();
        assertThat(report.getTotalInvoicedMinor()).isEqualTo(100000);
        assertThat(report.getTotalCollectedMinor()).isEqualTo(80000);
        assertThat(report.getTotalOutstandingMinor()).isEqualTo(20000);
    }

    @Test
    @DisplayName("getProfitLossReport computes net income correctly")
    void getProfitLossReport_success() {
        when(jdbc.queryForObject(any(String.class), eq(Long.class), eq(propertyId)))
            .thenReturn(150000L) // Income
            .thenReturn(50000L);  // Expense

        ProfitLossReportDto report = reportService.getProfitLossReport(propertyId);

        assertThat(report).isNotNull();
        assertThat(report.getTotalIncomeMinor()).isEqualTo(150000L);
        assertThat(report.getTotalExpenseMinor()).isEqualTo(50000L);
        assertThat(report.getNetIncomeMinor()).isEqualTo(100000L);
    }

    @Test
    @DisplayName("getArrearsReport returns list of overdue invoices")
    void getArrearsReport_success() {
        ArrearsReportDto dto = new ArrearsReportDto("inv_1", "INV-001", "mem_1", propertyId, 25000L, null);
        when(jdbc.query(any(String.class), any(RowMapper.class), eq(propertyId))).thenReturn(List.of(dto));

        List<ArrearsReportDto> arrears = reportService.getArrearsReport(propertyId);

        assertThat(arrears).hasSize(1);
        assertThat(arrears.get(0).getInvoiceCode()).isEqualTo("INV-001");
        assertThat(arrears.get(0).getAmountDueMinor()).isEqualTo(25000L);
    }
}
