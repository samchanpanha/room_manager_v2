package com.rentmanager.iam.dto;

import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.EffectivePermission;
import java.util.List;

/** Shape returned by GET /api/account and after login — mirrors AuthUser. */
public record AccountResponse(
    String id,
    String name,
    String email,
    List<String> roles,
    List<String> propertyIds,
    List<EffectivePermission> permissions,
    boolean superAdmin,
    boolean totpEnrollmentRequired,
    boolean mustChangePassword) {

  public static AccountResponse from(AuthPrincipal p) {
    return new AccountResponse(p.id(), p.name(), p.email(), p.roles(),
        p.propertyIds(), p.permissions(), p.superAdmin(),
        p.totpEnrollmentRequired(), p.mustChangePassword());
  }
}
