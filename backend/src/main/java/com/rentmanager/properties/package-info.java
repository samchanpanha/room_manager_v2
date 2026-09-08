/**
 * Properties & Rooms (INTENT.md M04): the physical inventory —
 * Property → Building → Floor → Room → Bed.
 */
@org.springframework.modulith.ApplicationModule(
    allowedDependencies = { "platform", "kernel", "iam" }
)
package com.rentmanager.properties;
