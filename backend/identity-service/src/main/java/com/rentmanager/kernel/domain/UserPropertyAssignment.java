package com.rentmanager.kernel.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

/**
 * User ↔ Property assignment, the basis of PROPERTY-scoped RBDC checks. Bound
 * to the Prisma {@code UserPropertyAssignment} table. Read-only for slice 1.
 */
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

  public String getUserId() { return userId; }
  public String getPropertyId() { return propertyId; }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof UserPropertyAssignment that)) return false;
    return userId.equals(that.userId) && propertyId.equals(that.propertyId);
  }

  @Override
  public int hashCode() {
    int result = userId.hashCode();
    result = 31 * result + propertyId.hashCode();
    return result;
  }
}