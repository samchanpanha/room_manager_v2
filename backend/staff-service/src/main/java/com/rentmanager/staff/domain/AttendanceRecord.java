package com.rentmanager.staff.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"AttendanceRecord\"")
public class AttendanceRecord {

    @Id
    private String id;

    @Column(name = "\"userId\"", nullable = false)
    private String userId;

    @Column(name = "\"propertyId\"", nullable = false)
    private String propertyId;

    @Column(name = "\"shiftId\"")
    private String shiftId;

    @Column(name = "\"workDate\"", nullable = false)
    private Instant workDate;

    @Column(name = "\"clockInAt\"", nullable = false)
    private Instant clockInAt;

    @Column(name = "\"clockOutAt\"")
    private Instant clockOutAt;

    @Column(name = "\"inLat\"")
    private Double inLat;

    @Column(name = "\"inLng\"")
    private Double inLng;

    @Column(name = "\"inGeoStatus\"")
    private String inGeoStatus; // inside | outside | unknown

    @Column(name = "\"minutesWorked\"")
    private Integer minutesWorked;

    @Column(name = "\"overtimeMinutes\"")
    private Integer overtimeMinutes;

    @Column(name = "source", nullable = false)
    private String source; // kiosk | mobile | manual

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "\"updatedAt\"", nullable = false)
    private Instant updatedAt = Instant.now();

    public AttendanceRecord() {}

    public AttendanceRecord(String id, String userId, String propertyId, Instant workDate, Instant clockInAt, String source) {
        this.id = id;
        this.userId = userId;
        this.propertyId = propertyId;
        this.workDate = workDate;
        this.clockInAt = clockInAt;
        this.source = source;
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public String getShiftId() { return shiftId; }
    public void setShiftId(String shiftId) { this.shiftId = shiftId; }

    public Instant getWorkDate() { return workDate; }
    public void setWorkDate(Instant workDate) { this.workDate = workDate; }

    public Instant getClockInAt() { return clockInAt; }
    public void setClockInAt(Instant clockInAt) { this.clockInAt = clockInAt; }

    public Instant getClockOutAt() { return clockOutAt; }
    public void setClockOutAt(Instant clockOutAt) { this.clockOutAt = clockOutAt; }

    public Double getInLat() { return inLat; }
    public void setInLat(Double inLat) { this.inLat = inLat; }

    public Double getInLng() { return inLng; }
    public void setInLng(Double inLng) { this.inLng = inLng; }

    public String getInGeoStatus() { return inGeoStatus; }
    public void setInGeoStatus(String inGeoStatus) { this.inGeoStatus = inGeoStatus; }

    public Integer getMinutesWorked() { return minutesWorked; }
    public void setMinutesWorked(Integer minutesWorked) { this.minutesWorked = minutesWorked; }

    public Integer getOvertimeMinutes() { return overtimeMinutes; }
    public void setOvertimeMinutes(Integer overtimeMinutes) { this.overtimeMinutes = overtimeMinutes; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
