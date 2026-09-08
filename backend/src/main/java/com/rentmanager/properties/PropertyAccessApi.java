package com.rentmanager.properties;

import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.platform.web.ApiException;
import com.rentmanager.properties.domain.Property;
import com.rentmanager.properties.domain.PropertyRepositories;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Published property-lookup API consumed by other modules (e.g. billing M07)
 * that need to validate a propertyId without touching the properties module's
 * internals. Part of the properties module's supported cross-module surface.
 */
@Service
public class PropertyAccessApi {

  private final PropertyRepositories.Properties properties;

  public PropertyAccessApi(PropertyRepositories.Properties properties) {
    this.properties = properties;
  }

  public record PropertyInfo(String id, String code, String name) {}

  /** Load a property or 404 if it is outside the current tenant. */
  @Transactional(readOnly = true)
  public PropertyInfo requireProperty(String propertyId) {
    Property p = properties.findByIdAndTenantId(propertyId, TenantContext.get())
        .orElseThrow(() -> ApiException.notFound("Property " + propertyId + " not found"));
    return new PropertyInfo(p.getId(), p.getCode(), p.getName());
  }

  /**
   * All property ids in the current tenant — used by modules that hold a GLOBAL
   * RBDC grant and need to widen a property-scoped query to every property
   * (e.g. the M15 category/valuation lists for an Admin).
   */
  @Transactional(readOnly = true)
  public java.util.List<String> allPropertyIds() {
    return properties.findByTenantIdOrderByCode(TenantContext.get()).stream()
        .map(Property::getId).toList();
  }
}
