package com.rentmanager.ops.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"MaintenanceTicket\"")
public class MaintenanceTicket {

    @Id
    private String id;

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Column(name = "\"propertyId\"", nullable = false)
    private String propertyId;

    @Column(name = "\"roomId\"")
    private String roomId;

    @Column(name = "\"leaseId\"")
    private String leaseId;

    @Column(name = "\"memberProfileId\"")
    private String memberProfileId;

    @Column(name = "category", nullable = false)
    private String category; // plumbing | electrical | appliance | furniture | internet | other

    @Column(name = "priority", nullable = false)
    private String priority = "medium"; // low | medium | high | urgent

    @Column(name = "status", nullable = false)
    private String status = "open"; // open | assigned | in_progress | resolved | verified | closed | cancelled

    @Column(name = "title", nullable = false)
    private String title;

    @Column(name = "description", nullable = false)
    private String description;

    @Column(name = "source", nullable = false)
    private String source = "staff"; // portal | telegram | staff

    @Column(name = "\"slaDueAt\"", nullable = false)
    private Instant slaDueAt;

    @Column(name = "\"assignedToId\"")
    private String assignedToId;

    @Column(name = "\"resolvedAt\"")
    private Instant resolvedAt;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "\"updatedAt\"", nullable = false)
    private Instant updatedAt = Instant.now();

    public MaintenanceTicket() {}

    public MaintenanceTicket(String id, String code, String propertyId, String category,
                             String priority, String title, String description, Instant slaDueAt) {
        this.id = id;
        this.code = code;
        this.propertyId = propertyId;
        this.category = category;
        this.priority = priority;
        this.title = title;
        this.description = description;
        this.slaDueAt = slaDueAt;
        this.status = "open";
        this.source = "staff";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }

    public String getLeaseId() { return leaseId; }
    public void setLeaseId(String leaseId) { this.leaseId = leaseId; }

    public String getMemberProfileId() { return memberProfileId; }
    public void setMemberProfileId(String memberProfileId) { this.memberProfileId = memberProfileId; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public Instant getSlaDueAt() { return slaDueAt; }
    public void setSlaDueAt(Instant slaDueAt) { this.slaDueAt = slaDueAt; }

    public String getAssignedToId() { return assignedToId; }
    public void setAssignedToId(String assignedToId) { this.assignedToId = assignedToId; }

    public Instant getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(Instant resolvedAt) { this.resolvedAt = resolvedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
