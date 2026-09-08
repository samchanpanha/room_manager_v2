/**
 * Cross-cutting platform concerns shared by all business modules: security
 * (session auth + RBDC authorization), multi-tenancy context, global error
 * handling, and API configuration. Declared as a shared module so every other
 * module may depend on it.
 */
@org.springframework.modulith.ApplicationModule
package com.rentmanager.platform;
