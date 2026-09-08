package com.rentmanager.platform.security;

import java.util.List;

/**
 * The authenticated subject placed in the Spring Security context. Mirrors the
 * Next app's {@code AuthUser} (src/lib/auth/session.ts) so RBDC behaves
 * identically on both stacks.
 */
public record AuthPrincipal(
    String id,
    String name,
    String email,
    String partyId,
    String sessionId,
    String tenantId,
    List<String> roles,
    List<String> propertyIds,
    List<EffectivePermission> permissions,
    boolean superAdmin,
    boolean totpEnrollmentRequired,
    boolean mustChangePassword) {

  public boolean isAdminPlus() {
    return roles.contains("SUPER_ADMIN") || roles.contains("ADMIN");
  }
}
