package com.rentmanager.platform.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Reads the {@code rm_session} cookie, resolves it to an {@link AuthPrincipal}
 * via the {@link SessionResolver} SPI (implemented by the IAM module — same
 * lookup as the Next app), and populates the Spring Security context +
 * {@link com.rentmanager.kernel.tenant.TenantContext}.
 */
@Component
public class SessionAuthFilter extends OncePerRequestFilter {

  private final SessionResolver sessionResolver;

  public SessionAuthFilter(SessionResolver sessionResolver) {
    this.sessionResolver = sessionResolver;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String token = readCookie(request, sessionResolver.sessionCookieName());
    if (token != null) {
      sessionResolver.resolve(token).ifPresent(principal -> {
        List<SimpleGrantedAuthority> authorities = principal.roles().stream()
            .map(r -> new SimpleGrantedAuthority("ROLE_" + r))
            .toList();
        var auth = new UsernamePasswordAuthenticationToken(principal, null, authorities);
        SecurityContextHolder.getContext().setAuthentication(auth);
        // Authenticated tenant is authoritative for the rest of the request.
        com.rentmanager.kernel.tenant.TenantContext.set(principal.tenantId());
      });
    }
    chain.doFilter(request, response);
  }

  private static String readCookie(HttpServletRequest request, String name) {
    Cookie[] cookies = request.getCookies();
    if (cookies == null) return null;
    for (Cookie c : cookies) {
      if (name.equals(c.getName())) return c.getValue();
    }
    return null;
  }
}
