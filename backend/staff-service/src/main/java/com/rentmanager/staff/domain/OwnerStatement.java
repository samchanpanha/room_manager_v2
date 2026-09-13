package com.rentmanager.staff.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"OwnerStatement\"")
public class OwnerStatement {

    @Id
    private String id;

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Column(name = "\"ownerProfileId\"", nullable = false)
    private String ownerProfileId;

    @Column(name = "\"contractId\"", nullable = false)
    private String contractId;

    @Column(name = "\"buildingId\"", nullable = false)
    private String buildingId;

    @Column(name = "\"propertyId\"", nullable = false)
    private String propertyId;

    @Column(name = "month", nullable = false)
    private String month; // YYYY-MM

    @Column(name = "status", nullable = false)
    private String status = "draft"; // draft | approved | paid

    @Column(name = "\"collectedMinor\"", nullable = false)
    private int collectedMinor;

    @Column(name = "\"grossShareMinor\"", nullable = false)
    private int grossShareMinor;

    @Column(name = "\"managementFeeMinor\"", nullable = false)
    private int managementFeeMinor;

    @Column(name = "\"passthroughMinor\"", nullable = false)
    private int passthroughMinor = 0;

    @Column(name = "\"ownerMaintenanceMinor\"", nullable = false)
    private int ownerMaintenanceMinor = 0;

    @Column(name = "\"adjustmentsMinor\"", nullable = false)
    private int adjustmentsMinor = 0;

    @Column(name = "\"netMinor\"", nullable = false)
    private int netMinor;

    @Column(name = "\"lineSnapshot\"", nullable = false)
    private String lineSnapshot;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "\"updatedAt\"", nullable = false)
    private Instant updatedAt = Instant.now();

    public OwnerStatement() {}

    public OwnerStatement(String id, String code, String ownerProfileId, String contractId,
                          String buildingId, String propertyId, String month,
                          int collectedMinor, int grossShareMinor, int managementFeeMinor, int netMinor, String lineSnapshot) {
        this.id = id;
        this.code = code;
        this.ownerProfileId = ownerProfileId;
        this.contractId = contractId;
        this.buildingId = buildingId;
        this.propertyId = propertyId;
        this.month = month;
        this.collectedMinor = collectedMinor;
        this.grossShareMinor = grossShareMinor;
        this.managementFeeMinor = managementFeeMinor;
        this.netMinor = netMinor;
        this.lineSnapshot = lineSnapshot;
        this.status = "draft";
        this.createdAt = Instant.now();
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getOwnerProfileId() { return ownerProfileId; }
    public void setOwnerProfileId(String ownerProfileId) { this.ownerProfileId = ownerProfileId; }

    public String getContractId() { return contractId; }
    public void setContractId(String contractId) { this.contractId = contractId; }

    public String getBuildingId() { return buildingId; }
    public void setBuildingId(String buildingId) { this.buildingId = buildingId; }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public String getMonth() { return month; }
    public void setMonth(String month) { this.month = month; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getCollectedMinor() { return collectedMinor; }
    public void setCollectedMinor(int collectedMinor) { this.collectedMinor = collectedMinor; }

    public int getGrossShareMinor() { return grossShareMinor; }
    public void setGrossShareMinor(int grossShareMinor) { this.grossShareMinor = grossShareMinor; }

    public int getManagementFeeMinor() { return managementFeeMinor; }
    public void setManagementFeeMinor(int managementFeeMinor) { this.managementFeeMinor = managementFeeMinor; }

    public int getPassthroughMinor() { return passthroughMinor; }
    public void setPassthroughMinor(int passthroughMinor) { this.passthroughMinor = passthroughMinor; }

    public int getOwnerMaintenanceMinor() { return ownerMaintenanceMinor; }
    public void setOwnerMaintenanceMinor(int ownerMaintenanceMinor) { this.ownerMaintenanceMinor = ownerMaintenanceMinor; }

    public int getAdjustmentsMinor() { return adjustmentsMinor; }
    public void setAdjustmentsMinor(int adjustmentsMinor) { this.adjustmentsMinor = adjustmentsMinor; }

    public int getNetMinor() { return netMinor; }
    public void setNetMinor(int netMinor) { this.netMinor = netMinor; }

    public String getLineSnapshot() { return lineSnapshot; }
    public void setLineSnapshot(String lineSnapshot) { this.lineSnapshot = lineSnapshot; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
