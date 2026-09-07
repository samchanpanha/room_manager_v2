package com.rentmanager.platform.security;

import com.rentmanager.platform.web.ApiException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Convenience accessor + authorization guard used by controllers and services.
 * {@code require(action, module, ref)} mirrors the Next {@code authorize()}
 * guard (src/lib/rbac/guard.ts): 401 if unauthenticated, 403 if not permitted.
 */
@Component
public class CurrentUser {

  public AuthPrincipal getOrNull() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth == null || !auth.isAuthenticated()) return null;
    Object principal = auth.getPrincipal();
    return principal instanceof AuthPrincipal p ? p : null;
  }

  public AuthPrincipal require() {
    AuthPrincipal user = getOrNull();
    if (user == null) throw ApiException.unauthenticated();
    return user;
  }

  /** Authenticate + authorize in one step. Returns the principal on success. */
  public AuthPrincipal require(String action, String module) {
    return require(action, module, null);
  }

  public AuthPrincipal require(String action, String module, Rbdc.ResourceRef ref) {
    AuthPrincipal user = require();
    boolean allowed = ref != null
        ? Rbdc.can(user, action, module, ref)
        : Rbdc.can(user, action, module);
    if (!allowed) throw ApiException.forbidden(module, action);
    return user;
  }
}
