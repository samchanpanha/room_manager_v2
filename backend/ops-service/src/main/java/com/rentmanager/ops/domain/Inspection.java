package com.rentmanager.ops.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"Inspection\"")
public class Inspection {

    @Id
    private String id;

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Column(name = "type", nullable = false)
    private String type; // move_in | move_out | periodic

    @Column(name = "status", nullable = false)
    private String status = "draft"; // draft | completed | cancelled

    @Column(name = "\"leaseId\"", nullable = false)
    private String leaseId;

    @Column(name = "\"roomId\"", nullable = false)
    private String roomId;

    @Column(name = "\"propertyId\"", nullable = false)
    private String propertyId;

    @Column(name = "\"templateId\"")
    private String templateId;

    @Column(name = "\"scheduledAt\"")
    private Instant scheduledAt;

    @Column(name = "\"completedAt\"")
    private Instant completedAt;

    @Column(name = "\"overallScore\"")
    private Integer overallScore;

    @Column(name = "\"summaryNote\"")
    private String summaryNote;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "\"updatedAt\"", nullable = false)
    private Instant updatedAt = Instant.now();

    public Inspection() {}

    public Inspection(String id, String code, String type, String leaseId, String roomId, String propertyId) {
        this.id = id;
        this.code = code;
        this.type = type;
        this.leaseId = leaseId;
        this.roomId = roomId;
        this.propertyId = propertyId;
        this.status = "draft";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getLeaseId() { return leaseId; }
    public void setLeaseId(String leaseId) { this.leaseId = leaseId; }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public String getTemplateId() { return templateId; }
    public void setTemplateId(String templateId) { this.templateId = templateId; }

    public Instant getScheduledAt() { return scheduledAt; }
    public void setScheduledAt(Instant scheduledAt) { this.scheduledAt = scheduledAt; }

    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }

    public Integer getOverallScore() { return overallScore; }
    public void setOverallScore(Integer overallScore) { this.overallScore = overallScore; }

    public String getSummaryNote() { return summaryNote; }
    public void setSummaryNote(String summaryNote) { this.summaryNote = summaryNote; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
