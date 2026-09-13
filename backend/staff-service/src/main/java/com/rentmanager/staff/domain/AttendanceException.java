package com.rentmanager.staff.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"AttendanceException\"")
public class AttendanceException {

    @Id
    private String id;

    @Column(name = "\"recordId\"")
    private String recordId;

    @Column(name = "\"userId\"", nullable = false)
    private String userId;

    @Column(name = "\"propertyId\"", nullable = false)
    private String propertyId;

    @Column(name = "\"workDate\"", nullable = false)
    private Instant workDate;

    @Column(name = "type", nullable = false)
    private String type; // late_clock_in | early_clock_out | missed_clock_in | missed_clock_out | geofence_violation

    @Column(name = "detail", nullable = false)
    private String detail;

    @Column(name = "status", nullable = false)
    private String status = "open"; // open | resolved

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "\"updatedAt\"", nullable = false)
    private Instant updatedAt = Instant.now();

    public AttendanceException() {}

    public AttendanceException(String id, String recordId, String userId, String propertyId,
                               Instant workDate, String type, String detail) {
        this.id = id;
        this.recordId = recordId;
        this.userId = userId;
        this.propertyId = propertyId;
        this.workDate = workDate;
        this.type = type;
        this.detail = detail;
        this.status = "open";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getRecordId() { return recordId; }
    public void setRecordId(String recordId) { this.recordId = recordId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public Instant getWorkDate() { return workDate; }
    public void setWorkDate(Instant workDate) { this.workDate = workDate; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
