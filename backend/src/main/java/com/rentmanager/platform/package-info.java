/**
 * Spring Modulith module {@code platform}: cross-cutting security and web
 * plumbing shared by all business modules — the {@code rm_session} auth filter,
 * the RBDC primitive, the {@code {error, message}} error envelope and the
 * health endpoint. Shared module, excluded from boundary verification; marked
 * {@code OPEN} so sub-package types are visible to every dependant.
 */
@org.springframework.modulith.ApplicationModule(
    type = org.springframework.modulith.ApplicationModule.Type.OPEN
)
package com.rentmanager.platform;