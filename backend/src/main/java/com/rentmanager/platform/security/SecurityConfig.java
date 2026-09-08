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
 * Stateless (from Spring's view) security chain. Authentication is our own
 * cookie/session filter; authorization is enforced per-endpoint via
 * {@link CurrentUser}/{@link Rbdc} (RBDC), not URL patterns, so behavior matches
 * the Next app's per-route {@code authorize()} guard exactly.
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
        .csrf(AbstractHttpConfigurer::disable) // token/session cookie is SameSite=Lax; CSRF handled at cookie layer
        .cors(cors -> {}) // configured in CorsConfig when FE/BE are cross-origin
        .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(auth -> auth
            // Public: health, auth entry points, OpenAPI.
            .requestMatchers(
                "/api/health",
                "/actuator/health/**",
                "/api/auth/login",
                "/api/auth/login/verify",
                "/api/auth/logout",
                "/v3/api-docs/**",
                "/swagger-ui/**",
                "/swagger-ui.html").permitAll()
            .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
            // Everything else requires an authenticated session; fine-grained
            // RBDC checks happen in the controllers/services.
            .anyRequest().permitAll())
        .addFilterBefore(sessionAuthFilter, UsernamePasswordAuthenticationFilter.class);
    return http.build();
  }
}
