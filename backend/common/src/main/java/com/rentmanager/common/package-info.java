/**
 * Spring Modulith module {@code common}: shared DTOs, Kafka event envelopes,
 * Keycloak JWT converters, and RBDC primitives shared across all microservices.
 * Marked {@code OPEN} so sub-package types (e.g. {@code common.event}, {@code common.security})
 * are visible to all business modules.
 */
@org.springframework.modulith.ApplicationModule(
    type = org.springframework.modulith.ApplicationModule.Type.OPEN
)
package com.rentmanager.common;
