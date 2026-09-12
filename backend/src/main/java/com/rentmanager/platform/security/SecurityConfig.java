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
 * {@link CurrentUser}/{@link Rbdc} (RBDC), not URL patterns, so behavior
 * matches the Next app's per-route {@code authorize()} guard exactly: a missing
 * or invalid session surfaces as the handler's 401
 * {@code {error:"UNAUTHENTICATED", message:"Sign in required"}}.
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
        .csrf(AbstractHttpConfigurer::disable) // SameSite=Lax session cookie; CSRF handled at cookie layer
        .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(auth -> auth
            // Public endpoints (mirrors the Next routes that skip auth).
            .requestMatchers("/api/health", "/actuator/**").permitAll()
            .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
            // Everything else is permitted by the URL rules; auth + RBDC are
            // enforced in the controllers (CurrentUser.require()), exactly like
            // the Next handlers call getAuthUser()/authorize() themselves.
            .anyRequest().permitAll())
        .addFilterBefore(sessionAuthFilter, UsernamePasswordAuthenticationFilter.class);
    return http.build();
  }
}