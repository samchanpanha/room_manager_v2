package com.rentmanager.platform.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Dual-path authentication filter for the identity-service during the strangler-fig migration.
 *
 * <p><b>Path 1 — Session cookie (legacy/direct):</b><br>
 * Reads the {@code rm_session} cookie, resolves it to an {@link AuthPrincipal}
 * via {@link SessionResolver}. Used by the Next.js frontend calling identity-service
 * directly (pre-Gateway path).
 *
 * <p><b>Path 2 — Gateway headers (new):</b><br>
 * Reads {@code X-Rm-User-Id}, {@code X-Rm-Tenant-Id}, {@code X-Rm-Roles} headers
 * injected by {@code RbdcContextFilter} in the API Gateway after JWT validation.
 * When all three headers are present, a lightweight {@link AuthPrincipal} is built
 * from them — no DB lookup needed since the Gateway already validated the JWT.
 *
 * <p>The cookie path takes priority when both are present (direct call with cookie wins).
 * In production, direct access should be blocked at the network level (only Gateway traffic
 * reaches the service), but during migration both paths stay open.
 */
@Component
public class SessionAuthFilter extends OncePerRequestFilter {

    // Header names — must match RbdcContextFilter constants in the gateway module
    private static final String HDR_USER_ID   = "X-Rm-User-Id";
    private static final String HDR_TENANT_ID = "X-Rm-Tenant-Id";
    private static final String HDR_ROLES     = "X-Rm-Roles";

    private final SessionResolver sessionResolver;

    public SessionAuthFilter(SessionResolver sessionResolver) {
        this.sessionResolver = sessionResolver;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {

        // ── Path 1: session cookie (legacy/direct Next.js → identity-service) ──
        String cookieToken = readCookie(request, sessionResolver.sessionCookieName());
        if (cookieToken != null) {
            sessionResolver.resolve(cookieToken).ifPresent(principal -> authenticate(principal, request));
            chain.doFilter(request, response);
            return;
        }

        // ── Path 2: Gateway-injected identity headers ─────────────────────────
        String userId   = request.getHeader(HDR_USER_ID);
        String tenantId = request.getHeader(HDR_TENANT_ID);
        String rolesHdr = request.getHeader(HDR_ROLES);

        if (userId != null && !userId.isBlank() && tenantId != null && rolesHdr != null) {
            Set<String> roles = Arrays.stream(rolesHdr.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .collect(Collectors.toSet());

            // Lightweight principal from Gateway headers — permissions resolved lazily in
            // controllers that call the full RBDC engine (which may do a DB lookup for PROPERTY scope).
            AuthPrincipal principal = new AuthPrincipal(
                userId,            // id
                request.getHeader("X-Rm-Name") != null ? request.getHeader("X-Rm-Name") : userId, // name
                null,              // email (not in headers — load on demand)
                null,              // partyId
                null,              // sessionId (no session — JWT-originated)
                tenantId,
                List.copyOf(roles),
                List.of(),         // propertyIds — resolved lazily or from DB when needed
                List.of(),         // permissions — resolved lazily from DB
                roles.contains("SUPER_ADMIN"),
                false,             // totpEnrollmentRequired — already enforced at Gateway/Keycloak
                false              // mustChangePassword — not applicable for JWT path
            );
            authenticate(principal, request);
        }

        chain.doFilter(request, response);
    }

    private void authenticate(AuthPrincipal principal, HttpServletRequest request) {
        if (SecurityContextHolder.getContext().getAuthentication() != null) return;
        List<SimpleGrantedAuthority> authorities = principal.roles().stream()
                .map(r -> new SimpleGrantedAuthority("ROLE_" + r))
                .toList();
        var auth = new UsernamePasswordAuthenticationToken(principal, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private static String readCookie(HttpServletRequest request, String name) {
        jakarta.servlet.http.Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (jakarta.servlet.http.Cookie c : cookies) {
            if (name.equals(c.getName())) return c.getValue();
        }
        return null;
    }
}