package com.rentmanager.ops.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"Complaint\"")
public class Complaint {

    @Id
    private String id;

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Column(name = "\"propertyId\"", nullable = false)
    private String propertyId;

    @Column(name = "\"memberProfileId\"", nullable = false)
    private String memberProfileId;

    @Column(name = "\"leaseId\"")
    private String leaseId;

    @Column(name = "category", nullable = false)
    private String category; // noise | cleanliness | neighbor | staff | facility | billing | other

    @Column(name = "priority", nullable = false)
    private String priority = "medium"; // low | medium | high

    @Column(name = "source", nullable = false)
    private String source = "portal"; // portal | telegram | staff

    @Column(name = "status", nullable = false)
    private String status = "new"; // new | acknowledged | in_progress | resolved | closed

    @Column(name = "subject", nullable = false)
    private String subject;

    @Column(name = "description", nullable = false)
    private String description;

    @Column(name = "\"slaDueAt\"", nullable = false)
    private Instant slaDueAt;

    @Column(name = "\"assignedToId\"")
    private String assignedToId;

    @Column(name = "\"ticketId\"", unique = true)
    private String ticketId;

    @Column(name = "\"resolvedAt\"")
    private Instant resolvedAt;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "\"updatedAt\"", nullable = false)
    private Instant updatedAt = Instant.now();

    public Complaint() {}

    public Complaint(String id, String code, String propertyId, String memberProfileId,
                     String category, String subject, String description, Instant slaDueAt) {
        this.id = id;
        this.code = code;
        this.propertyId = propertyId;
        this.memberProfileId = memberProfileId;
        this.category = category;
        this.subject = subject;
        this.description = description;
        this.slaDueAt = slaDueAt;
        this.status = "new";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public String getMemberProfileId() { return memberProfileId; }
    public void setMemberProfileId(String memberProfileId) { this.memberProfileId = memberProfileId; }

    public String getLeaseId() { return leaseId; }
    public void setLeaseId(String leaseId) { this.leaseId = leaseId; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Instant getSlaDueAt() { return slaDueAt; }
    public void setSlaDueAt(Instant slaDueAt) { this.slaDueAt = slaDueAt; }

    public String getAssignedToId() { return assignedToId; }
    public void setAssignedToId(String assignedToId) { this.assignedToId = assignedToId; }

    public String getTicketId() { return ticketId; }
    public void setTicketId(String ticketId) { this.ticketId = ticketId; }

    public Instant getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(Instant resolvedAt) { this.resolvedAt = resolvedAt; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
