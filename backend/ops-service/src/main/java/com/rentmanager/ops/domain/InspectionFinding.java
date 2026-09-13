package com.rentmanager.ops.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"InspectionFinding\"")
public class InspectionFinding {

    @Id
    private String id;

    @Column(name = "\"inspectionId\"", nullable = false)
    private String inspectionId;

    @Column(name = "\"itemLabel\"", nullable = false)
    private String itemLabel;

    @Column(name = "severity", nullable = false)
    private String severity = "minor"; // minor | major | critical

    @Column(name = "note", nullable = false)
    private String note;

    @Column(name = "\"ticketId\"", unique = true)
    private String ticketId;

    @Column(name = "\"deductionMinor\"")
    private Integer deductionMinor;

    @Column(name = "\"deductionStatus\"")
    private String deductionStatus; // proposed | approved | dismissed

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "\"updatedAt\"", nullable = false)
    private Instant updatedAt = Instant.now();

    public InspectionFinding() {}

    public InspectionFinding(String id, String inspectionId, String itemLabel, String severity, String note) {
        this.id = id;
        this.inspectionId = inspectionId;
        this.itemLabel = itemLabel;
        this.severity = severity;
        this.note = note;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getInspectionId() { return inspectionId; }
    public void setInspectionId(String inspectionId) { this.inspectionId = inspectionId; }

    public String getItemLabel() { return itemLabel; }
    public void setItemLabel(String itemLabel) { this.itemLabel = itemLabel; }

    public String getSeverity() { return severity; }
    public void setSeverity(String severity) { this.severity = severity; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public String getTicketId() { return ticketId; }
    public void setTicketId(String ticketId) { this.ticketId = ticketId; }

    public Integer getDeductionMinor() { return deductionMinor; }
    public void setDeductionMinor(Integer deductionMinor) { this.deductionMinor = deductionMinor; }

    public String getDeductionStatus() { return deductionStatus; }
    public void setDeductionStatus(String deductionStatus) { this.deductionStatus = deductionStatus; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
