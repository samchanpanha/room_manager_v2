/**
 * IAM (INTENT.md M01 + M27): users, dynamic roles, the permission grid,
 * property scoping, sessions, authentication (password + TOTP challenge) and
 * the RBDC authorization primitives.
 *
 * <p>Named interfaces are the only allowed dependencies from other modules.
 */
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = { "platform", "kernel" }
)
package com.rentmanager.iam;
