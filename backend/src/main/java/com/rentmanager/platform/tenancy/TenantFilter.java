package com.rentmanager.platform.tenancy;

import com.rentmanager.kernel.tenant.TenantContext;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Resolves the tenant for each request and stores it in {@link TenantContext}.
 *
 * <p>Resolution order (first match wins):
 * <ol>
 *   <li>{@code X-Tenant-Id} header (service-to-service / admin tooling),</li>
 *   <li>later: the authenticated session's tenant (set by the auth filter),</li>
 *   <li>the configured default tenant.</li>
 * </ol>
 *
 * <p>Runs before security so the tenant filter can constrain any DB access made
 * while authenticating. The authenticated tenant, once known, is authoritative
 * and re-applied by the security layer.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class TenantFilter extends OncePerRequestFilter {

  private final String defaultTenant;

  public TenantFilter(TenantProperties props) {
    this.defaultTenant = props.defaultTenant();
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    try {
      String header = request.getHeader("X-Tenant-Id");
      TenantContext.set(header != null && !header.isBlank() ? header.trim() : defaultTenant);
      chain.doFilter(request, response);
    } finally {
      TenantContext.clear();
    }
  }
}
