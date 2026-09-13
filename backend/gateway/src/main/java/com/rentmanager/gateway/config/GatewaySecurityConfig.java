package com.rentmanager.gateway.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.reactive.EnableWebFluxSecurity;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;

/**
 * Spring Security configuration for the API Gateway (WebFlux / reactive).
 *
 * <p>All routes are JWT-authenticated by default. Public paths:
 * <ul>
 *   <li>Actuator health/info (internal monitoring)</li>
 *   <li>{@code /api/auth/**} — OTP/password login handled by identity-service</li>
 *   <li>{@code /api/health} — legacy Next.js health check</li>
 *   <li>{@code /api/telegram/**} POST — Telegram webhook (signed by secret in notification-svc)</li>
 *   <li>{@code /pay/**} — public QR payment page</li>
 * </ul>
 *
 * <p>The JWT converter is {@link ReactiveKeycloakJwtConverter} — the reactive variant
 * required by {@code ServerHttpSecurity} (Gateway is WebFlux, not MVC).
 */
@Configuration
@EnableWebFluxSecurity
public class GatewaySecurityConfig {

    private final SessionCookieMatcher sessionCookieMatcher;

    public GatewaySecurityConfig(SessionCookieMatcher sessionCookieMatcher) {
        this.sessionCookieMatcher = sessionCookieMatcher;
    }

    @Bean
    public SecurityWebFilterChain springSecurityFilterChain(ServerHttpSecurity http) {
        http
            .csrf(ServerHttpSecurity.CsrfSpec::disable)
            .authorizeExchange(exchanges -> exchanges

                // ── Legacy Next.js session cookie (strangler-fig bridge) ─────
                // The frontend still owns login and issues opaque rm_session cookies
                // that identity-service validates. Permit those through unchanged;
                // requests without a cookie must present a Keycloak JWT below.
                .matchers(sessionCookieMatcher).permitAll()

                // ── Infra, health, Actuator & OpenAPI docs ─────────────
                .pathMatchers("/actuator/**", "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**", "/webjars/**").permitAll()

                // ── Auth (identity-service handles these unauthenticated) ───
                .pathMatchers("/api/auth/**", "/api/health").permitAll()

                // ── Telegram webhook (signature verified in notification-svc) ─
                .pathMatchers(HttpMethod.POST, "/api/telegram/**").permitAll()

                // ── Public QR pay page ──────────────────────────────────────
                .pathMatchers("/pay/**").permitAll()

                // ── Everything else requires a valid Keycloak JWT ───────────
                .anyExchange().authenticated()
            )
            .oauth2ResourceServer(oauth2 ->
                // ReactiveKeycloakJwtConverter satisfies the WebFlux contract:
                // Converter<Jwt, Mono<? extends AbstractAuthenticationToken>>
                oauth2.jwt(jwt -> jwt.jwtAuthenticationConverter(
                    new ReactiveKeycloakJwtConverter()))
            );

        return http.build();
    }
}
