package com.rentmanager.billing.dto;

/** One requested line for a manual/draft invoice (M07). */
public record CreateInvoiceItemInput(String kind, String name, Integer qty, Double unit) {}
