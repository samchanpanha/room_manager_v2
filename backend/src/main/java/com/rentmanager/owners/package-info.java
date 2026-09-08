/**
 * Owners (INTENT.md M03): landlords whose buildings are managed, their payout
 * methods, and optional portal logins (OWNER role). Depends on IAM (portal user
 * + OWNER role), the properties module (building ownership) and the kernel.
 */
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = { "platform", "kernel", "iam", "properties" }
)
package com.rentmanager.owners;
