package com.rentmanager.ops.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"RoomMove\"")
public class RoomMove {

    @Id
    private String id;

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Column(name = "\"memberProfileId\"", nullable = false)
    private String memberProfileId;

    @Column(name = "\"fromLeaseId\"", nullable = false)
    private String fromLeaseId;

    @Column(name = "\"toRoomId\"", nullable = false)
    private String toRoomId;

    @Column(name = "\"effectiveAt\"", nullable = false)
    private Instant effectiveAt;

    @Column(name = "status", nullable = false)
    private String status = "requested"; // requested | approved | executed | cancelled

    @Column(name = "\"requestedByRole\"", nullable = false)
    private String requestedByRole = "staff";

    @Column(name = "\"newLeaseId\"", unique = true)
    private String newLeaseId;

    @Column(name = "\"adjustmentInvoiceId\"", unique = true)
    private String adjustmentInvoiceId;

    @Column(name = "\"oldRentMinor\"")
    private Integer oldRentMinor;

    @Column(name = "\"newRentMinor\"")
    private Integer newRentMinor;

    @Column(name = "\"moveFeeMinor\"")
    private Integer moveFeeMinor;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "\"updatedAt\"", nullable = false)
    private Instant updatedAt = Instant.now();

    public RoomMove() {}

    public RoomMove(String id, String code, String memberProfileId, String fromLeaseId, String toRoomId, Instant effectiveAt) {
        this.id = id;
        this.code = code;
        this.memberProfileId = memberProfileId;
        this.fromLeaseId = fromLeaseId;
        this.toRoomId = toRoomId;
        this.effectiveAt = effectiveAt;
        this.status = "requested";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getMemberProfileId() { return memberProfileId; }
    public void setMemberProfileId(String memberProfileId) { this.memberProfileId = memberProfileId; }

    public String getFromLeaseId() { return fromLeaseId; }
    public void setFromLeaseId(String fromLeaseId) { this.fromLeaseId = fromLeaseId; }

    public String getToRoomId() { return toRoomId; }
    public void setToRoomId(String toRoomId) { this.toRoomId = toRoomId; }

    public Instant getEffectiveAt() { return effectiveAt; }
    public void setEffectiveAt(Instant effectiveAt) { this.effectiveAt = effectiveAt; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getRequestedByRole() { return requestedByRole; }
    public void setRequestedByRole(String requestedByRole) { this.requestedByRole = requestedByRole; }

    public String getNewLeaseId() { return newLeaseId; }
    public void setNewLeaseId(String newLeaseId) { this.newLeaseId = newLeaseId; }

    public String getAdjustmentInvoiceId() { return adjustmentInvoiceId; }
    public void setAdjustmentInvoiceId(String adjustmentInvoiceId) { this.adjustmentInvoiceId = adjustmentInvoiceId; }

    public Integer getOldRentMinor() { return oldRentMinor; }
    public void setOldRentMinor(Integer oldRentMinor) { this.oldRentMinor = oldRentMinor; }

    public Integer getNewRentMinor() { return newRentMinor; }
    public void setNewRentMinor(Integer newRentMinor) { this.newRentMinor = newRentMinor; }

    public Integer getMoveFeeMinor() { return moveFeeMinor; }
    public void setMoveFeeMinor(Integer moveFeeMinor) { this.moveFeeMinor = moveFeeMinor; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
