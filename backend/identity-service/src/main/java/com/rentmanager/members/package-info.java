/**
 * Spring Modulith module {@code members}: the M02 members read path
 * ({@code GET /api/members}), ported for parity from
 * {@code src/app/api/members/route.ts}.
 */
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = {"kernel", "platform"}
)
package com.rentmanager.members;