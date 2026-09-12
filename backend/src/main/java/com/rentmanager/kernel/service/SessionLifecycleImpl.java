package com.rentmanager.kernel.service;

import com.rentmanager.kernel.domain.Session;
import com.rentmanager.kernel.domain.SessionRepository;
import com.rentmanager.platform.security.SessionLifecycle;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Wire-compatible session lifecycle backing the auth controllers. Mirrors
 * {@code createSession} / {@code destroyCurrentSession} in
 * src/lib/auth/session.ts:
 *
 * <ul>
 *   <li>token = {@code randomBytes(32).hex}</li>
 *   <li>DB stores only {@code sha256(token)}</li>
 *   <li>{@code expiresAt = now + SESSION_TTL_DAYS} days (default 30)</li>
 *   <li>revocation sets {@code revokedAt} only when it is currently null</li>
 * </ul>
 */
@Component
public class SessionLifecycleImpl implements SessionLifecycle {

  private static final SecureRandom RANDOM = new SecureRandom();
  private static final int TOKEN_BYTES = 32;

  private final SessionRepository sessions;
  private final Environment env;

  public SessionLifecycleImpl(SessionRepository sessions, Environment env) {
    this.sessions = sessions;
    this.env = env;
  }

  @Override
  @Transactional
  public SessionIssued create(String userId, String userAgent, String ip) {
    String token = hex(randomBytes(TOKEN_BYTES));
    int ttlDays = env.getProperty("SESSION_TTL_DAYS", Integer.class, 30);
    Instant createdAt = Instant.now().truncatedTo(ChronoUnit.MILLIS);
    Instant expiresAt = createdAt.plus(ttlDays, ChronoUnit.DAYS);
    sessions.save(new Session(
        newId(),
        userId,
        sha256Hex(token),
        userAgent == null ? null : userAgent,
        ip == null ? null : ip,
        createdAt,
        expiresAt));
    return new SessionIssued(token, expiresAt);
  }

  @Override
  @Transactional
  public boolean revoke(String rawToken) {
    return sessions.revokeByTokenHash(sha256Hex(rawToken), Instant.now()) > 0;
  }

  private static String newId() {
    return UUID.randomUUID().toString().replace("-", "");
  }

  private static byte[] randomBytes(int n) {
    byte[] bytes = new byte[n];
    RANDOM.nextBytes(bytes);
    return bytes;
  }

  private static String hex(byte[] bytes) {
    StringBuilder sb = new StringBuilder(bytes.length * 2);
    for (byte b : bytes) sb.append(String.format("%02x", b));
    return sb.toString();
  }

  private static String sha256Hex(String input) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
      StringBuilder sb = new StringBuilder(digest.length * 2);
      for (byte b : digest) {
        sb.append(Character.forDigit((b >> 4) & 0xF, 16));
        sb.append(Character.forDigit(b & 0xF, 16));
      }
      return sb.toString();
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 unavailable", e);
    }
  }
}