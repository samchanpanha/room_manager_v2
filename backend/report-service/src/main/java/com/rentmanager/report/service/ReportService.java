package com.rentmanager.report.service;

import com.rentmanager.report.dto.ArrearsReportDto;
import com.rentmanager.report.dto.OccupancyReportDto;
import com.rentmanager.report.dto.ProfitLossReportDto;
import com.rentmanager.report.dto.RevenueReportDto;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

@Service
public class ReportService {

    private final JdbcTemplate jdbc;

    public ReportService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "occupancyReports", key = "#propertyId")
    public OccupancyReportDto getOccupancyReport(String propertyId) {
        String sql = """
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'occupied' THEN 1 END) as occupied,
                COUNT(CASE WHEN status = 'vacant' THEN 1 END) as vacant,
                COUNT(CASE WHEN status = 'maintenance' THEN 1 END) as maintenance
            FROM "Room"
            WHERE "propertyId" = ?
            """;

        return jdbc.queryForObject(sql, (rs, rowNum) -> new OccupancyReportDto(
            propertyId,
            rs.getInt("total"),
            rs.getInt("occupied"),
            rs.getInt("vacant"),
            rs.getInt("maintenance")
        ), propertyId);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "revenueReports", key = "#propertyId")
    public RevenueReportDto getRevenueReport(String propertyId) {
        String invSql = """
            SELECT 
                COALESCE(SUM("totalMinor"), 0) as invoiced,
                COALESCE(SUM("amountPaidMinor"), 0) as collected,
                COALESCE(SUM("amountDueMinor"), 0) as outstanding
            FROM "Invoice"
            WHERE "propertyId" = ?
            """;

        return jdbc.queryForObject(invSql, (rs, rowNum) -> new RevenueReportDto(
            propertyId,
            rs.getLong("invoiced"),
            rs.getLong("collected"),
            rs.getLong("outstanding")
        ), propertyId);
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "profitLossReports", key = "#propertyId")
    public ProfitLossReportDto getProfitLossReport(String propertyId) {
        String incomeSql = "SELECT COALESCE(SUM(\"amountMinor\"), 0) FROM \"Payment\" WHERE \"propertyId\" = ? AND status = 'confirmed'";
        String expenseSql = "SELECT COALESCE(SUM(\"amountMinor\"), 0) FROM \"Expense\" WHERE \"propertyId\" = ? AND status = 'approved'";

        Long income = jdbc.queryForObject(incomeSql, Long.class, propertyId);
        Long expense = jdbc.queryForObject(expenseSql, Long.class, propertyId);

        return new ProfitLossReportDto(
            propertyId,
            income != null ? income : 0L,
            expense != null ? expense : 0L
        );
    }

    @Transactional(readOnly = true)
    public List<ArrearsReportDto> getArrearsReport(String propertyId) {
        String sql = """
            SELECT id, code, "memberProfileId", "propertyId", "amountDueMinor", "dueDate"
            FROM "Invoice"
            WHERE "propertyId" = ? AND "amountDueMinor" > 0
            ORDER BY "dueDate" ASC
            """;

        return jdbc.query(sql, (rs, rowNum) -> {
            Timestamp ts = rs.getTimestamp("dueDate");
            Instant due = ts != null ? ts.toInstant() : null;
            return new ArrearsReportDto(
                rs.getString("id"),
                rs.getString("code"),
                rs.getString("memberProfileId"),
                rs.getString("propertyId"),
                rs.getLong("amountDueMinor"),
                due
            );
        }, propertyId);
    }
}
