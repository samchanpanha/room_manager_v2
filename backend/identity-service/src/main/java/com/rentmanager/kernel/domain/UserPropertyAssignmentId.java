package com.rentmanager.kernel.domain;

import java.io.Serializable;
import java.util.Objects;

/** Composite id of {@link UserPropertyAssignment}: {@code (userId, propertyId)}. */
public class UserPropertyAssignmentId implements Serializable {

  private String userId;
  private String propertyId;

  protected UserPropertyAssignmentId() {}

  public UserPropertyAssignmentId(String userId, String propertyId) {
    this.userId = userId;
    this.propertyId = propertyId;
  }

  @Override
  public boolean equals(Object o) {
    if (this == o) return true;
    if (!(o instanceof UserPropertyAssignmentId that)) return false;
    return Objects.equals(userId, that.userId) && Objects.equals(propertyId, that.propertyId);
  }

  @Override
  public int hashCode() {
    return Objects.hash(userId, propertyId);
  }
}