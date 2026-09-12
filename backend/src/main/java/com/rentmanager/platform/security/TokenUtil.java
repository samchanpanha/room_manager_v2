package com.rentmanager.platform.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * Session-token hashing, wire-compatible with the Next app
 * (src/lib/auth/session.ts): the cookie carries {@code randomBytes(32).hex}
 * and the DB stores {@code sha256(token)} as {@code Session.tokenHash}.
 */
public final class TokenUtil {

  private TokenUtil() {}

  public static String sha256Hex(String input) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
      StringBuilder sb = new StringBuilder(digest.length * 2);
      for (byte b : digest) {
        sb.append(Character.forDigit((b >> 4) & 0xF, 16));
        sb.append(Character.forDigit(b & 0xF, 16));
      }
      return sb.toString();
    } catch (Exception e) {
      throw new IllegalStateException("SHA-256 unavailable", e);
    }
  }
}