package com.rentmanager.iam.domain;

import jakarta.persistence.*;

/** Restricts a user to a property (PROPERTY scope). Bound to {@code UserPropertyAssignment}. */
@Entity
@Table(name = "UserPropertyAssignment")
@IdClass(UserPropertyAssignmentId.class)
public class UserPropertyAssignment {

  @Id
  @Column(name = "userId")
  private String userId;

  @Id
  @Column(name = "propertyId")
  private String propertyId;

  protected UserPropertyAssignment() {}

  public String getPropertyId() { return propertyId; }
}
