/**
 * Spring Modulith module {@code kernel}: domain entities bound to the Prisma-owned
 * schema, their repositories, and the session identity/audit/account services.
 * Shared module; implements the {@code platform} {@code SessionResolver} and
 * {@code SessionLifecycle} SPIs.
 *
 * <p>Marked {@code OPEN}: it is depended upon by every business module, and its
 * types live in sub-packages, so the closed rules' flat unnamed-interface
 * lookup would otherwise reject every legal cross-module reference.
 */
@org.springframework.modulith.ApplicationModule(
    type = org.springframework.modulith.ApplicationModule.Type.OPEN,
    allowedDependencies = {"platform"}
)
package com.rentmanager.kernel;