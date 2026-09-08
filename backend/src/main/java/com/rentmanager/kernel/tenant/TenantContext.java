package com.rentmanager.kernel.tenant;

/**
 * Holds the current request's tenant id in a {@link ThreadLocal}.
 *
 * <p>Tenancy is a cross-cutting kernel concern (INTENT.md M00), so this lives in
 * the kernel module and every other module may depend on it. It is populated by
 * the platform {@code TenantFilter}/auth filter from the authenticated principal
 * (or the default tenant for unauthenticated/system flows). Every tenant-scoped
 * query reads from here, and the Hibernate tenant filter is enabled with this
 * value so cross-tenant reads are impossible even if a {@code where} clause is
 * forgotten.
 */
public final class TenantContext {

  public static final String DEFAULT_TENANT = "DEFAULT";

  private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();

  private TenantContext() {}

  public static void set(String tenantId) {
    CURRENT.set(tenantId);
  }

  /** @return the current tenant id, or the default tenant when none is set. */
  public static String get() {
    String t = CURRENT.get();
    return t != null ? t : DEFAULT_TENANT;
  }

  public static boolean isSet() {
    return CURRENT.get() != null;
  }

  public static void clear() {
    CURRENT.remove();
  }
}
