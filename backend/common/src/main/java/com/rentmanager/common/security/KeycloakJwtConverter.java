package com.rentmanager.common.security;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Converts a Keycloak-issued JWT into a Spring Security {@link JwtAuthenticationToken}
 * whose {@link JwtAuthenticationToken#getName()} is the RentManager internal user ID,
 * extracted from the {@code sub} claim or from a custom {@code rm_user_id} claim set
 * via a Keycloak protocol mapper.
 *
 * <p>The JWT claims structure emitted by the {@code rentmanager} realm:
 * <pre>{@code
 * {
 *   "sub":       "keycloak-user-uuid",
 *   "rm_user_id":"cuid-from-rentmanager-users-table",  // set by custom mapper
 *   "tenant_id": "DEFAULT",
 *   "roles":     ["ADMIN", "PROPERTY_MANAGER"],
 *   "email":     "user@example.com",
 *   "name":      "Jane Smith"
 * }
 * }</pre>
 *
 * <p>Register this converter in each service's {@code SecurityConfig}:
 * <pre>{@code
 *   http.oauth2ResourceServer(oauth2 ->
 *       oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(new KeycloakJwtConverter())));
 * }</pre>
 */
public class KeycloakJwtConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    /** Custom JWT claim injected by Keycloak protocol mapper carrying the internal cuid. */
    public static final String CLAIM_RM_USER_ID  = "rm_user_id";
    public static final String CLAIM_TENANT_ID   = "tenant_id";
    public static final String CLAIM_ROLES        = "roles";

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        String userId   = jwt.getClaimAsString(CLAIM_RM_USER_ID);
        if (userId == null) userId = jwt.getSubject(); // fallback for initial SSO users

        String tenantId = jwt.getClaimAsString(CLAIM_TENANT_ID);
        if (tenantId == null) tenantId = "DEFAULT";

        String email = jwt.getClaimAsString("email");
        String name  = jwt.getClaimAsString("name");

        List<?> rawRoles = jwt.getClaimAsStringList(CLAIM_ROLES);
        Set<String> roles = rawRoles == null
            ? Collections.emptySet()
            : rawRoles.stream().map(Object::toString).collect(Collectors.toSet());

        // Build AuthPrincipal — effectivePermissions resolved downstream by RBDC engine
        var principal = new AuthPrincipal(
            userId, tenantId, email, name, roles,
            Collections.emptySet(),  // assignedPropertyIds loaded from DB per service
            Collections.emptyList()  // effectivePermissions resolved by each service
        );

        // Wrap in a JwtAuthenticationToken so Spring Security's filter chain accepts it
        var token = new JwtAuthenticationToken(jwt, List.of(), userId);
        token.setDetails(principal);
        return token;
    }
}
