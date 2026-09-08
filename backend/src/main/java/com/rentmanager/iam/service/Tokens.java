package com.rentmanager.iam.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

/**
 * Session token helpers, wire-compatible with the Next app
 * (src/lib/auth/session.ts): the cookie carries {@code randomBytes(32).hex}
 * and the DB stores {@code sha256(token)} as {@code tokenHash}.
 */
final class Tokens {

  private static final SecureRandom RANDOM = new SecureRandom();

  private Tokens() {}

  static String newToken() {
    byte[] bytes = new byte[32];
    RANDOM.nextBytes(bytes);
    return toHex(bytes);
  }

  static String sha256Hex(String input) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      return toHex(md.digest(input.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  static String toHex(byte[] bytes) {
    StringBuilder sb = new StringBuilder(bytes.length * 2);
    for (byte b : bytes) {
      sb.append(Character.forDigit((b >> 4) & 0xF, 16));
      sb.append(Character.forDigit(b & 0xF, 16));
    }
    return sb.toString();
  }
}
