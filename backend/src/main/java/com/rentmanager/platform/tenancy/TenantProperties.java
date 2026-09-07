package com.rentmanager.platform.tenancy;

import com.rentmanager.kernel.tenant.TenantContext;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Binds {@code rentmanager.tenancy.*}. */
@ConfigurationProperties(prefix = "rentmanager.tenancy")
public record TenantProperties(String defaultTenant) {
  public TenantProperties {
    if (defaultTenant == null || defaultTenant.isBlank()) {
      defaultTenant = TenantContext.DEFAULT_TENANT;
    }
  }
}
