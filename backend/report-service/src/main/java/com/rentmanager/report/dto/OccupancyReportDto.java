package com.rentmanager.report.dto;

public class OccupancyReportDto {
    private String propertyId;
    private int totalRooms;
    private int occupiedRooms;
    private int vacantRooms;
    private int maintenanceRooms;
    private double occupancyRate;

    public OccupancyReportDto() {}

    public OccupancyReportDto(String propertyId, int totalRooms, int occupiedRooms, int vacantRooms, int maintenanceRooms) {
        this.propertyId = propertyId;
        this.totalRooms = totalRooms;
        this.occupiedRooms = occupiedRooms;
        this.vacantRooms = vacantRooms;
        this.maintenanceRooms = maintenanceRooms;
        this.occupancyRate = totalRooms > 0 ? ((double) occupiedRooms / totalRooms) * 100.0 : 0.0;
    }

    public String getPropertyId() { return propertyId; }
    public void setPropertyId(String propertyId) { this.propertyId = propertyId; }

    public int getTotalRooms() { return totalRooms; }
    public void setTotalRooms(int totalRooms) { this.totalRooms = totalRooms; }

    public int getOccupiedRooms() { return occupiedRooms; }
    public void setOccupiedRooms(int occupiedRooms) { this.occupiedRooms = occupiedRooms; }

    public int getVacantRooms() { return vacantRooms; }
    public void setVacantRooms(int vacantRooms) { this.vacantRooms = vacantRooms; }

    public int getMaintenanceRooms() { return maintenanceRooms; }
    public void setMaintenanceRooms(int maintenanceRooms) { this.maintenanceRooms = maintenanceRooms; }

    public double getOccupancyRate() { return occupancyRate; }
    public void setOccupancyRate(double occupancyRate) { this.occupancyRate = occupancyRate; }
}
