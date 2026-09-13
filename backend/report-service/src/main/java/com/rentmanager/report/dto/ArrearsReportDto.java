package com.rentmanager.report.dto;

import java.time.Instant;

public class ArrearsReportDto {
    private String invoiceId;
    private String invoiceCode;
    private String memberProfileId;
    private String propertyId;
    private long amountDueMinor;
    private Instant dueDate;

    public ArrearsReportDto() {}

    public ArrearsReportDto(String invoiceId, String invoiceCode, String memberProfileId, String propertyId, long amountDueMinor, Instant dueDate) {
        this.invoiceId = invoiceId;
        this.invoiceCode = invoiceCode;
        this.memberProfileId = memberProfileId;
        this.propertyId = propertyId;
        this.amountDueMinor = amountDueMinor;
        this.dueDate = dueDate;
    }

    public String getInvoiceId() { return invoiceId; }
    public void setInvoiceId(String invoiceId) { this.invoiceId = invoiceId; }

    public String getInvoiceCode() { return invoiceCode; }
    public void setInvoiceCode(String invoiceCode) { this.invoiceCode = invoiceCode; }

    public String getMemberProfileId() { return memberProfileId; }
    public void setMemberProfileId(String memberProfileId) { this.memberProfileId = memberProfileId; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public long getAmountDueMinor() { return amountDueMinor; }
    public void setAmountDueMinor(long amountDueMinor) { this.amountDueMinor = amountDueMinor; }

    public Instant getDueDate() { return dueDate; }
    public void setDueDate(Instant dueDate) { this.dueDate = dueDate; }
}
