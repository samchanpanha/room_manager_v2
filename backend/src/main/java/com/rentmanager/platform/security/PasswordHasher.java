package com.rentmanager.platform.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

/**
 * Password hashing wire-compatible with the Next app
 * (src/lib/auth/password.ts). Stored form is {@code scrypt:<saltHex>:<hashHex>}
 * where:
 *
 * <ul>
 *   <li>{@code saltHex} is 16 random bytes as a hex string,</li>
 *   <li>the salt bytes fed to scrypt are the UTF-8 bytes of that hex string
 *       (Node passes the string as-is to {@code scryptSync}),</li>
 *   <li>the digest is the 64-byte scrypt output with {@code N=16384, r=8, p=1},</li>
 *   <li>{@code hashHex} is that digest hex-encoded.</li>
 * </ul>
 *
 * <p>Comparison is constant-time ({@link MessageDigest#isEqual}), mirroring
 * Node's {@code timingSafeEqual}.
 */
public final class PasswordHasher {

  public static final String PREFIX = "scrypt:";
  public static final int N = 16384;
  public static final int R = 8;
  public static final int P = 1;
  public static final int KEY_LEN = 64;
  private static final int SALT_BYTES = 16;

  private static final char[] HEX = "0123456789abcdef".toCharArray();
  private static final SecureRandom RANDOM = new SecureRandom();

  private PasswordHasher() {}

  public static String hashPassword(String password) {
    byte[] saltBytes = new byte[SALT_BYTES];
    RANDOM.nextBytes(saltBytes);
    String salt = hex(saltBytes);
    byte[] hash = Scrypt.derive(password.getBytes(StandardCharsets.UTF_8),
        salt.getBytes(StandardCharsets.UTF_8), N, R, P, KEY_LEN);
    return PREFIX + salt + ":" + hex(hash);
  }

  public static boolean verifyPassword(String password, String stored) {
    if (stored == null) return false;
    String[] parts = stored.split(":");
    if (parts.length != 3 || !"scrypt".equals(parts[0])) return false;
    byte[] expected;
    try {
      expected = hexDecode(parts[2]);
    } catch (IllegalArgumentException e) {
      return false;
    }
    // The NEXT app feeds the hex string's UTF-8 bytes to scryptSync as the salt.
    byte[] actual = Scrypt.derive(password.getBytes(StandardCharsets.UTF_8),
        parts[1].getBytes(StandardCharsets.UTF_8), N, R, P, KEY_LEN);
    return MessageDigest.isEqual(expected, actual);
  }

  private static String hex(byte[] bytes) {
    char[] out = new char[bytes.length * 2];
    for (int i = 0; i < bytes.length; i++) {
      int v = bytes[i] & 0xff;
      out[2 * i] = HEX[v >>> 4];
      out[2 * i + 1] = HEX[v & 0x0f];
    }
    return new String(out);
  }

  private static byte[] hexDecode(String hex) {
    if ((hex.length() & 1) != 0) throw new IllegalArgumentException("odd-length hex");
    byte[] out = new byte[hex.length() / 2];
    for (int i = 0; i < out.length; i++) {
      int hi = Character.digit(hex.charAt(2 * i), 16);
      int lo = Character.digit(hex.charAt(2 * i + 1), 16);
      if (hi < 0 || lo < 0) throw new IllegalArgumentException("non-hex digit");
      out[i] = (byte) ((hi << 4) | lo);
    }
    return out;
  }
}