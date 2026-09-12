package com.rentmanager.platform.security;

import java.util.Optional;

/**
 * SPI implemented by the {@code kernel} module and consumed by the platform
 * security filter. Declaring it in {@code platform} keeps the dependency arrow
 * one-way ({@code kernel → platform}); the concrete implementation is injected
 * at runtime, so there is no module cycle (Spring Modulith {@code verify()}
 * stays green).
 */
public interface SessionResolver {

  /** Resolve a raw session cookie value to a principal, or empty if invalid. */
  Optional<AuthPrincipal> resolve(String rawToken);

  /** Name of the session cookie to read (e.g. {@code rm_session}). */
  String sessionCookieName();
}