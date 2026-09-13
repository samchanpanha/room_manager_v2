package com.rentmanager.report.dto;

public class RevenueReportDto {
    private String propertyId;
    private long totalInvoicedMinor;
    private long totalCollectedMinor;
    private long totalOutstandingMinor;

    public RevenueReportDto() {}

    public RevenueReportDto(String propertyId, long totalInvoicedMinor, long totalCollectedMinor, long totalOutstandingMinor) {
        this.propertyId = propertyId;
        this.totalInvoicedMinor = totalInvoicedMinor;
        this.totalCollectedMinor = totalCollectedMinor;
        this.totalOutstandingMinor = totalOutstandingMinor;
    }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public long getTotalInvoicedMinor() { return totalInvoicedMinor; }
    public void setTotalInvoicedMinor(long totalInvoicedMinor) { this.totalInvoicedMinor = totalInvoicedMinor; }

    public long getTotalCollectedMinor() { return totalCollectedMinor; }
    public void setTotalCollectedMinor(long totalCollectedMinor) { this.totalCollectedMinor = totalCollectedMinor; }

    public long getTotalOutstandingMinor() { return totalOutstandingMinor; }
    public void setTotalOutstandingMinor(long totalOutstandingMinor) { this.totalOutstandingMinor = totalOutstandingMinor; }
}
