package com.rentmanager.report.dto;

public class ProfitLossReportDto {
    private String propertyId;
    private long totalIncomeMinor;
    private long totalExpenseMinor;
    private long netIncomeMinor;

    public ProfitLossReportDto() {}

    public ProfitLossReportDto(String propertyId, long totalIncomeMinor, long totalExpenseMinor) {
        this.propertyId = propertyId;
        this.totalIncomeMinor = totalIncomeMinor;
        this.totalExpenseMinor = totalExpenseMinor;
        this.netIncomeMinor = totalIncomeMinor - totalExpenseMinor;
    }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public long getTotalIncomeMinor() { return totalIncomeMinor; }
    public void setTotalIncomeMinor(long totalIncomeMinor) { this.totalIncomeMinor = totalIncomeMinor; }

    public long getTotalExpenseMinor() { return totalExpenseMinor; }
    public void setTotalExpenseMinor(long totalExpenseMinor) { this.totalExpenseMinor = totalExpenseMinor; }

    public long getNetIncomeMinor() { return netIncomeMinor; }
    public void setNetIncomeMinor(long netIncomeMinor) { this.netIncomeMinor = netIncomeMinor; }
}
