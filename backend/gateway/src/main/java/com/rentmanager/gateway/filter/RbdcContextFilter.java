package com.rentmanager.gateway.filter;

import com.rentmanager.common.security.AuthPrincipal;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * Global Gateway filter that extracts the {@link AuthPrincipal} from the
 * validated JWT and injects identity headers so downstream microservices can
 * trust the caller without re-validating the JWT themselves.
 *
 * <p>Headers injected:
 * <ul>
 *   <li>{@code X-Rm-User-Id}   — internal RentManager user cuid</li>
 *   <li>{@code X-Rm-Tenant-Id} — tenant/org ID</li>
 *   <li>{@code X-Rm-Roles}     — comma-separated realm roles</li>
 *   <li>{@code X-Correlation-Id} — echoed from inbound request (or generated)</li>
 * </ul>
 *
 * <p>Downstream services MUST reject requests that arrive without these headers
 * (i.e., they must not be accessible directly, only via the gateway).
 *
 * <p>Public paths (Keycloak login, actuator, legacy Next.js /api/health) bypass
 * JWT validation and this filter does not inject identity headers.
 */
@Component
public class RbdcContextFilter implements GlobalFilter, Ordered {

    /** Filter runs after Spring Security's JWT validation filter. */
    private static final int ORDER = -100;

    // Header name constants — shared convention across all services
    public static final String HEADER_USER_ID        = "X-Rm-User-Id";
    public static final String HEADER_TENANT_ID      = "X-Rm-Tenant-Id";
    public static final String HEADER_ROLES          = "X-Rm-Roles";
    public static final String HEADER_CORRELATION_ID = "X-Correlation-Id";

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        return ReactiveSecurityContextHolder.getContext()
            .flatMap(ctx -> {
                var auth = ctx.getAuthentication();

                // Not authenticated (public route) — pass through unchanged
                if (auth == null || !(auth instanceof JwtAuthenticationToken jwtAuth)) {
                    return chain.filter(exchange);
                }

                if (!(jwtAuth.getDetails() instanceof AuthPrincipal principal)) {
                    // JwtAuthenticationToken without our AuthPrincipal detail — reject
                    exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
                    return exchange.getResponse().setComplete();
                }

                // Build mutated request with identity headers
                ServerHttpRequest mutatedRequest = exchange.getRequest().mutate()
                    .header(HEADER_USER_ID, principal.userId())
                    .header(HEADER_TENANT_ID, principal.tenantId())
                    .header(HEADER_ROLES, String.join(",", principal.roles()))
                    .header(HEADER_CORRELATION_ID, resolveCorrelationId(exchange))
                    // Strip Authorization header downstream (services trust our X-Rm-* headers)
                    // Uncomment in prod: .headers(h -> h.remove("Authorization"))
                    .build();

                return chain.filter(exchange.mutate().request(mutatedRequest).build());
            })
            // No security context at all (anonymous / public path)
            .switchIfEmpty(chain.filter(exchange));
    }

    @Override
    public int getOrder() {
        return ORDER;
    }

    private String resolveCorrelationId(ServerWebExchange exchange) {
        String existing = exchange.getRequest().getHeaders().getFirst(HEADER_CORRELATION_ID);
        return (existing != null && !existing.isBlank())
            ? existing
            : java.util.UUID.randomUUID().toString();
    }
}
