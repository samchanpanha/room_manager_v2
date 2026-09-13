package com.rentmanager.gateway.config;

import com.rentmanager.common.security.AuthPrincipal;
import com.rentmanager.common.security.KeycloakJwtConverter;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import reactor.core.publisher.Mono;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * <b>Reactive</b> variant of Keycloak JWT converter for use in
 * Spring Cloud Gateway (WebFlux / {@code ServerHttpSecurity}).
 *
 * <p>Spring Cloud Gateway's {@code oauth2ResourceServer().jwt()} expects a
 * {@code Converter<Jwt, Mono<? extends AbstractAuthenticationToken>>}, not the
 * blocking {@code Converter<Jwt, AbstractAuthenticationToken>} used by Spring MVC
 * resource servers. This wrapper delegates to the synchronous conversion logic
 * and lifts the result into a {@code Mono}.
 */
public class ReactiveKeycloakJwtConverter
        implements Converter<Jwt, Mono<AbstractAuthenticationToken>> {

    @Override
    public Mono<AbstractAuthenticationToken> convert(Jwt jwt) {
        String userId   = jwt.getClaimAsString(KeycloakJwtConverter.CLAIM_RM_USER_ID);
        if (userId == null) userId = jwt.getSubject();

        String tenantId = jwt.getClaimAsString(KeycloakJwtConverter.CLAIM_TENANT_ID);
        if (tenantId == null) tenantId = "DEFAULT";

        String email = jwt.getClaimAsString("email");
        String name  = jwt.getClaimAsString("name");

        List<?> rawRoles = jwt.getClaimAsStringList(KeycloakJwtConverter.CLAIM_ROLES);
        Set<String> roles = rawRoles == null
            ? Collections.emptySet()
            : rawRoles.stream().map(Object::toString).collect(Collectors.toSet());

        var principal = new AuthPrincipal(
            userId, tenantId, email, name, roles,
            Collections.emptySet(),
            Collections.emptyList()
        );

        var token = new JwtAuthenticationToken(jwt, List.of(), userId);
        token.setDetails(principal);
        return Mono.just(token);
    }
}
