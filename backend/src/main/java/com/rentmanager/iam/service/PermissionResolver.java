package com.rentmanager.iam.service;

import com.rentmanager.iam.domain.RolePermission;
import com.rentmanager.iam.domain.User;
import com.rentmanager.iam.domain.UserRole;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.EffectivePermission;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * Resolves a {@link User} into an {@link AuthPrincipal} with the union of all
 * role permissions — a faithful port of {@code getAuthUser()} / the
 * {@code unionPermissions} logic in {@code src/lib/auth/session.ts}.
 */
@Component
public class PermissionResolver {

  private static final Set<String> ADMIN_PLUS = Set.of("SUPER_ADMIN", "ADMIN");

  public AuthPrincipal toPrincipal(User user, String sessionId) {
    List<String> roles = new ArrayList<>();
    List<EffectivePermission> perms = unionPermissions(user);
    for (UserRole ur : user.getRoles()) {
      if (ur.getRole() != null) roles.add(ur.getRole().getKey());
    }
    List<String> propertyIds = user.getAssignments().stream()
        .map(a -> a.getPropertyId())
        .toList();

    boolean isSuper = roles.contains("SUPER_ADMIN");
    boolean isAdminPlus = roles.stream().anyMatch(ADMIN_PLUS::contains);
    boolean totpEnrollmentRequired = isAdminPlus && !user.isTotpEnabled();

    return new AuthPrincipal(
        user.getId(),
        user.getName(),
        user.getEmail(),
        user.getPartyId(),
        sessionId,
        user.getTenantId(),
        roles,
        propertyIds,
        perms,
        isSuper,
        totpEnrollmentRequired,
        user.isMustChangePassword());
  }

  private List<EffectivePermission> unionPermissions(User user) {
    Set<String> seen = new LinkedHashSet<>();
    List<EffectivePermission> out = new ArrayList<>();
    for (UserRole ur : user.getRoles()) {
      if (ur.getRole() == null) continue;
      for (RolePermission rp : ur.getRole().getPermissions()) {
        if (rp.getPermission() == null) continue;
        String module = rp.getPermission().getModule();
        String action = rp.getPermission().getAction();
        String scope = rp.getScope();
        String key = module + ":" + action + ":" + scope;
        if (seen.add(key)) out.add(new EffectivePermission(module, action, scope));
      }
    }
    return out;
  }
}
