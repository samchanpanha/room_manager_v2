/**
 * Spring Modulith module {@code auth}: the login/logout/session and
 * self-service account paths ({@code POST /api/auth/login},
 * {@code POST /api/auth/logout}, {@code PATCH /api/account}), ported for parity
 * from {@code src/app/api/auth/login/route.ts}, {@code src/app/api/auth/logout/route.ts}
 * and {@code src/app/api/account/route.ts}. Depends on the shared {@code kernel}
 * (session/audit/account services) and {@code platform} (security SPI + web envelope).
 */
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = {"kernel", "platform"}
)
package com.rentmanager.auth;