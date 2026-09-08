package com.rentmanager.properties.dto;

/** List-row for the properties page: property + occupancy + building count. */
public record PropertyRow(
    String id,
    String code,
    String name,
    String address,
    String status,
    long buildingCount,
    long roomsTotal,
    long roomsOccupied) {}
