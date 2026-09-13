package com.rentmanager.platform.security;

/**
 * Role-Based Dynamic Access Control primitive — a faithful Java port of
 * {@code can()} in {@code src/lib/rbac/can.ts}. Pure functions; the single
 * enforcement point used by every controller/service.
 */
public final class Rbdc {

  private Rbdc() {}

  /** Resource reference used for scope resolution. */
  public record ResourceRef(String propertyId, String ownerUserId) {
    public static ResourceRef none() { return new ResourceRef(null, null); }
    public static ResourceRef property(String propertyId) { return new ResourceRef(propertyId, null); }
    public static ResourceRef own(String ownerUserId) { return new ResourceRef(null, ownerUserId); }
  }

  /** {@code can(user, action, module, resource?)}. */
  public static boolean can(AuthPrincipal user, String action, String module, ResourceRef resource) {
    // §M27: Admin+ that have not enrolled TOTP get nothing except M27.
    if (user.totpEnrollmentRequired() && !"M27".equals(module)) return false;
    for (EffectivePermission p : user.permissions()) {
      if (!p.module().equals(module) || !p.action().equals(action)) continue;
      switch (p.scope()) {
        case "GLOBAL" -> { return true; }
        case "PROPERTY" -> {
          if (resource != null && resource.propertyId() != null
              && user.propertyIds().contains(resource.propertyId())) return true;
        }
        case "OWN" -> {
          if (resource != null && resource.ownerUserId() != null
              && resource.ownerUserId().equals(user.id())) return true;
        }
        default -> { /* ignore unknown scope */ }
      }
    }
    return false;
  }

  public static boolean can(AuthPrincipal user, String action, String module) {
    return can(user, action, module, null);
  }

  /**
   * Page-gate helper: does the user hold ANY grant of (module, action) at any
   * scope? Callers then scope the data themselves. Mirrors {@code hasModuleAccess}.
   */
  public static boolean hasModuleAccess(AuthPrincipal user, String action, String module) {
    if (user.totpEnrollmentRequired() && !"M27".equals(module)) return false;
    return user.permissions().stream()
        .anyMatch(p -> p.module().equals(module) && p.action().equals(action));
  }

  /** Widest scope the user holds for (module, action): GLOBAL &gt; PROPERTY &gt; OWN &gt; null. */
  public static String widestScope(AuthPrincipal user, String action, String module) {
    if (user.totpEnrollmentRequired() && !"M27".equals(module)) return null;
    String best = null;
    for (EffectivePermission p : user.permissions()) {
      if (!p.module().equals(module) || !p.action().equals(action)) continue;
      if ("GLOBAL".equals(p.scope())) return "GLOBAL";
      if ("PROPERTY".equals(p.scope())) best = "PROPERTY";
      else if ("OWN".equals(p.scope()) && best == null) best = "OWN";
    }
    return best;
  }
}