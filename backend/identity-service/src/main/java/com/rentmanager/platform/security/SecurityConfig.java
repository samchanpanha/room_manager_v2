package com.rentmanager.platform.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

/**
 * Security filter chain for identity-service.
 *
 * <p>Dual-auth strategy (strangler-fig migration period):
 * <ol>
 *   <li><b>Session cookie</b> — legacy Next.js direct calls; resolved by {@link SessionAuthFilter}
 *       via the existing scrypt-hashed session kernel.</li>
 *   <li><b>Gateway headers</b> — Keycloak JWT-validated requests relayed by
 *       {@code RbdcContextFilter}; trust is established by the {@code X-Rm-User-Id} /
 *       {@code X-Rm-Tenant-Id} / {@code X-Rm-Roles} headers.</li>
 * </ol>
 *
 * <p>URL-level authorization is intentionally permissive here — every controller
 * enforces RBDC via {@link CurrentUser#require()} + {@link Rbdc#can()}, exactly
 * mirroring the Next.js handler pattern. This avoids duplicate rule maintenance.
 */
@Configuration
public class SecurityConfig {

    private final SessionAuthFilter sessionAuthFilter;

    public SecurityConfig(SessionAuthFilter sessionAuthFilter) {
        this.sessionAuthFilter = sessionAuthFilter;
    }

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(AbstractHttpConfigurer::disable)
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                // Infra, health & OpenAPI docs — always public
                .requestMatchers("/api/health", "/actuator/**", "/swagger-ui.html", "/swagger-ui/**", "/v3/api-docs/**", "/v3/api-docs").permitAll()
                // Auth endpoints — login, OTP, TOTP challenge (handled by controllers before RBDC)
                .requestMatchers(HttpMethod.POST, "/api/auth/**").permitAll()
                // CORS preflight
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                // Everything else: auth is checked inside each controller via CurrentUser.require()
                // to match the Next.js pattern exactly (no duplicate URL-level rules).
                .anyRequest().permitAll()
            )
            .addFilterBefore(sessionAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}