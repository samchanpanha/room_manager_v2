package com.rentmanager.gateway.config;

import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.security.web.server.util.matcher.ServerWebExchangeMatcher;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Strategy-fig migration bridge: lets the legacy Next.js frontend authenticate
 * through the Gateway using its existing {@code rm_session} cookie.
 *
 * <p>The Next.js app still owns the login flow and issues opaque sessions that are
 * later resolved by {@code identity-service}'s {@code SessionAuthFilter} (same
 * {@code Session} table as the frontend). Requesting a JWT from the browser would
 * break the half-migrated UI, so — only when a non-blank {@code rm_session} cookie
 * is present — the Gateway permits the request and forwards it unchanged. The
 * downstream service (identity-service) is the authority that validates the session;
 * all other services keep trusting the {@code X-Rm-*} headers injected for JWT calls.
 *
 * <p>Requests without a cookie still go through normal Keycloak JWT validation
 * ({@code anyExchange().authenticated()}).
 */
@Component
public class SessionCookieMatcher implements ServerWebExchangeMatcher {

    public static final String RM_SESSION_COOKIE = "rm_session";

    @Override
    public Mono<MatchResult> matches(ServerWebExchange exchange) {
        ServerHttpRequest request = exchange.getRequest();
        var cookie = request.getCookies().getFirst(RM_SESSION_COOKIE);
        if (cookie != null && cookie.getValue() != null && !cookie.getValue().isBlank()) {
            return MatchResult.match();
        }
        return MatchResult.notMatch();
    }
}