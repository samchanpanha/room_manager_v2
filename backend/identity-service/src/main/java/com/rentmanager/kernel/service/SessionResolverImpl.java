package com.rentmanager.kernel.service;

import com.rentmanager.kernel.domain.RolePermission;
import com.rentmanager.kernel.domain.RolePermissionId;
import com.rentmanager.kernel.domain.Session;
import com.rentmanager.kernel.domain.SessionRepository;
import com.rentmanager.kernel.domain.User;
import com.rentmanager.kernel.domain.UserPropertyAssignment;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.EffectivePermission;
import com.rentmanager.platform.security.SessionResolver;
import com.rentmanager.platform.security.TokenUtil;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Wire-compatible implementation of the platform {@link SessionResolver},
 * mirroring {@code getAuthUser()} in src/lib/auth/session.ts:
 *
 * <ul>
 *   <li>cookie token → {@code sha256(token)} → {@code Session.tokenHash}</li>
 *   <li>session must not be revoked, must not be expired, user status active</li>
 *   <li>effective permissions = union of role permissions, deduped by
 *       {@code module:action:scope} (first occurrence wins)</li>
 *   <li>{@code totpEnrollmentRequired} = {@code ENFORCE_MANDATORY_TOTP} &&
 *       Admin+ && !user.totpEnabled (M27 rule)</li>
 * </ul>
 */
@Component
public class SessionResolverImpl implements SessionResolver {

  private final SessionRepository sessions;
  private final Environment env;

  public SessionResolverImpl(SessionRepository sessions, Environment env) {
    this.sessions = sessions;
    this.env = env;
  }

  @Override
  public String sessionCookieName() {
    return "rm_session";
  }

  @Override
  @Transactional(readOnly = true)
  public Optional<AuthPrincipal> resolve(String rawToken) {
    String tokenHash = TokenUtil.sha256Hex(rawToken);
    return sessions.findByTokenHash(tokenHash)
        .map(SessionResolverImpl::validate)
        .orElseGet(Optional::empty)
        .map(this::toPrincipal);
  }

  /** Same validity rules as {@code getAuthUser()}. */
  private static Optional<Session> validate(Session s) {
    User u = s.getUser();
    if (s.getRevokedAt() != null) return Optional.empty();
    if (!s.getExpiresAt().isAfter(Instant.now())) return Optional.empty();
    if (!"active".equals(u.getStatus())) return Optional.empty();
    return Optional.of(s);
  }

  private AuthPrincipal toPrincipal(Session s) {
    User u = s.getUser();

    List<String> roles = u.getRoles().stream()
        .map(ur -> ur.getRole().getKey())
        .toList();

    // unionPermissions(...): dedupe by module:action:scope, first occurrence wins.
    LinkedHashMap<RolePermissionId, EffectivePermission> union = new LinkedHashMap<>();
    for (com.rentmanager.kernel.domain.UserRole ur : u.getRoles()) {
      for (RolePermission rp : ur.getRole().getPermissions()) {
        EffectivePermission ep = new EffectivePermission(
            rp.getPermission().getModule(),
            rp.getPermission().getAction(),
            rp.getScope());
        union.putIfAbsent(new RolePermissionId(ep.module(), ep.action(), ep.scope()), ep);
      }
    }
    List<EffectivePermission> permissions = List.copyOf(union.values());

    boolean isAdminPlus = roles.contains("SUPER_ADMIN") || roles.contains("ADMIN");
    boolean enforce = "true".equals(env.getProperty("ENFORCE_MANDATORY_TOTP", "false"));
    boolean totpEnrollmentRequired = enforce && isAdminPlus && !u.isTotpEnabled();

    return new AuthPrincipal(
        u.getId(),
        u.getName(),
        u.getEmail(),
        u.getPartyId(),
        s.getId(),
        u.getTenantId(),
        roles,
        u.getAssignments().stream().map(UserPropertyAssignment::getPropertyId).toList(),
        permissions,
        roles.contains("SUPER_ADMIN"),
        totpEnrollmentRequired,
        u.isMustChangePassword());
  }
}