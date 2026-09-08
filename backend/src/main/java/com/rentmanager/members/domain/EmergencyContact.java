package com.rentmanager.members.domain;

import com.rentmanager.kernel.Cuid;
import jakarta.persistence.*;

/** Bound to Prisma {@code EmergencyContact}. */
@Entity
@Table(name = "EmergencyContact")
public class EmergencyContact {

  @Id
  @Column(name = "id")
  private String id = Cuid.generate();

  @Column(name = "memberProfileId", nullable = false)
  private String memberProfileId;

  @Column(name = "name", nullable = false)
  private String name;

  @Column(name = "relationship", nullable = false)
  private String relationship;

  @Column(name = "phone", nullable = false)
  private String phone;

  @Column(name = "email")
  private String email;

  @Column(name = "isPrimary", nullable = false)
  private boolean primary = false;

  @Column(name = "tenantId", nullable = false)
  private String tenantId;

  protected EmergencyContact() {}

  public EmergencyContact(String name, String relationship, String phone,
      String email, boolean primary, String tenantId) {
    this.name = name;
    this.relationship = relationship;
    this.phone = phone;
    this.email = email;
    this.primary = primary;
    this.tenantId = tenantId;
  }

  public String getId() { return id; }
  public String getName() { return name; }
  public String getRelationship() { return relationship; }
  public String getPhone() { return phone; }
  public String getEmail() { return email; }
  public boolean isPrimary() { return primary; }
}
