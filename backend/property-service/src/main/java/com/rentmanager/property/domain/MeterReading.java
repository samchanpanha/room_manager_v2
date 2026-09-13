package com.rentmanager.property.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "\"MeterReading\"")
public class MeterReading {

    @Id
    private String id;

    @Column(name = "\"meterId\"", nullable = false)
    private String meterId;

    @Column(name = "\"valueMilli\"", nullable = false)
    private int valueMilli;

    @Column(name = "\"readAt\"", nullable = false)
    private Instant readAt;

    @Column(name = "estimated", nullable = false)
    private boolean estimated = false;

    @Column(name = "source", nullable = false)
    private String source = "manual";

    @Column(name = "note")
    private String note;

    @Column(name = "\"createdById\"")
    private String createdById;

    @Column(name = "\"createdAt\"", nullable = false)
    private Instant createdAt = Instant.now();

    public MeterReading() {}

    public MeterReading(String id, String meterId, int valueMilli, Instant readAt, String source) {
        this.id = id;
        this.meterId = meterId;
        this.valueMilli = valueMilli;
        this.readAt = readAt;
        this.source = source;
        this.createdAt = Instant.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getMeterId() { return meterId; }
    public void setMeterId(String meterId) { this.meterId = meterId; }

    public int getValueMilli() { return valueMilli; }
    public void setValueMilli(int valueMilli) { this.valueMilli = valueMilli; }

    public Instant getReadAt() { return readAt; }
    public void setReadAt(Instant readAt) { this.readAt = readAt; }

    public boolean isEstimated() { return estimated; }
    public void setEstimated(boolean estimated) { this.estimated = estimated; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public String getCreatedById() { return createdById; }
    public void setCreatedById(String createdById) { this.createdById = createdById; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
