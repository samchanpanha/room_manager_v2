package com.rentmanager.platform.security;

import java.time.Instant;

/**
 * SPI for minting/revoking DB-backed {@code rm_session} sessions, implemented by
 * the {@code kernel} module and consumed by the auth controllers. Mirrors
 * {@code createSession}/{@code destroyCurrentSession} in src/lib/auth/session.ts.
 * Declared in {@code platform} (shared) so the dependency arrow stays one-way
 * ({@code kernel → platform}), matching the {@link SessionResolver} pattern.
 */
public interface SessionLifecycle {

  /** Mint a session row and return the raw (cookie-bound) token and its expiry. */
  SessionIssued create(String userId, String userAgent, String ip);

  /** Revoke the session whose token hash equals {@code sha256(rawToken)}, if it is not already revoked. */
  boolean revoke(String rawToken);

  /** The raw token a caller should place in the {@code rm_session} cookie. */
  record SessionIssued(String rawToken, Instant expiresAt) {}
}