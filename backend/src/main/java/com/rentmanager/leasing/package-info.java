/**
 * Leasing (INTENT.md M05): member occupancy leases with a state machine
 * (draft → active → notice → terminated | completed), occupancy rules, and the
 * activation/ending effects that flip room + member status and schedule the
 * first invoice. Owner contracts and the rent engine (M06) land in this module
 * in later phases.
 */
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = { "platform", "kernel", "members", "properties", "billing" }
)
package com.rentmanager.leasing;
