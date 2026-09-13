package com.rentmanager.common.security;

import java.util.List;
import java.util.Set;

/**
 * Immutable representation of the authenticated principal, populated from either:
 * <ul>
 *   <li>A Keycloak JWT (via {@link KeycloakJwtConverter}) — for requests through the Gateway</li>
 *   <li>The hand-rolled session cookie (existing kernel) — for legacy Next.js paths</li>
 * </ul>
 *
 * <p>This record is intentionally framework-agnostic so the RBDC engine
 * ({@code Rbdc.java}, which already exists in the Slice-1 platform module) can
 * consume it without depending on Spring Security internals.
 */
public record AuthPrincipal(
    /** Internal RentManager user ID (cuid). */
    String userId,

    /** Tenant/org ID this user belongs to. */
    String tenantId,

    /** User's email address. */
    String email,

    /** Display name. */
    String name,

    /**
     * Realm-level roles claimed in the JWT ({@code roles} claim) or resolved
     * from {@code user_roles} table for session-auth paths.
     * Values match INTENT.md §5 role keys: SUPER_ADMIN, ADMIN, PROPERTY_MANAGER, etc.
     */
    Set<String> roles,

    /**
     * Property IDs this user is assigned to.
     * Empty set = GLOBAL scope (all properties); populated for PROPERTY-scoped roles.
     */
    Set<String> assignedPropertyIds,

    /**
     * Effective flat permission set resolved by the RBDC engine.
     * Format: {@code "<module>:<action>:<scope>"} e.g. {@code "M07:read:GLOBAL"}.
     * Populated lazily in the Gateway filter and forwarded via {@code X-Rm-Permissions} header.
     */
    List<String> effectivePermissions
) {

    /** Convenience: true when user holds the SUPER_ADMIN role. */
    public boolean isSuperAdmin() {
        return roles.contains("SUPER_ADMIN");
    }

    /** Convenience: true when user's roles include any of the given keys. */
    public boolean hasAnyRole(String... roleKeys) {
        for (String r : roleKeys) {
            if (roles.contains(r)) return true;
        }
        return false;
    }
}
