package com.rentmanager.billing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "\"LedgerAccount\"")
public class LedgerAccount {

    @Id
    private String id;

    @Column(name = "code", nullable = false, unique = true)
    private String code; // 1100, 1200, 2100, 4000, 4100, 4200

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "type", nullable = false)
    private String type; // ASSET | LIABILITY | INCOME | EXPENSE | EQUITY

    @Column(name = "\"isSystem\"", nullable = false)
    private boolean isSystem = true;

    @Column(name = "\"isActive\"", nullable = false)
    private boolean isActive = true;

    public LedgerAccount() {}

    public LedgerAccount(String id, String code, String name, String type) {
        this.id = id;
        this.code = code;
        this.name = name;
        this.type = type;
        this.isSystem = true;
        this.isActive = true;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public boolean isSystem() { return isSystem; }
    public void setSystem(boolean system) { isSystem = system; }

    public boolean isActive() { return isActive; }
    public void setActive(boolean active) { isActive = active; }
}
