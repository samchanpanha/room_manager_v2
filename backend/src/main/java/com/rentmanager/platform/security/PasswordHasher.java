package com.rentmanager.platform.security;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Arrays;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

/**
 * Password hashing wire-compatible with the Next app's
 * {@code src/lib/auth/password.ts}:
 *
 * <pre>{@code
 *   hash   = "scrypt:" + saltHex + ":" + hex(scrypt(password, saltHex, keyLen=64))
 *   verify = constant-time compare
 * }</pre>
 *
 * <p>Node's {@code crypto.scryptSync(pw, salt, 64)} uses defaults
 * N=16384, r=8, p=1 and hashes with the salt taken as raw UTF-8 bytes of the
 * hex salt string (Node passes the JS string directly). We replicate exactly so
 * existing password hashes verify and new ones are readable by the Next app.
 *
 * <p>scrypt is implemented here (no external dependency) per RFC 7914.
 */
@Component
public class PasswordHasher {

  private static final int N = 16384;
  private static final int R = 8;
  private static final int P = 1;
  private static final int KEY_LEN = 64;
  private static final SecureRandom RANDOM = new SecureRandom();

  public String hash(String password) {
    byte[] saltBytes = new byte[16];
    RANDOM.nextBytes(saltBytes);
    String saltHex = toHex(saltBytes);
    byte[] derived = scrypt(password.getBytes(StandardCharsets.UTF_8),
        saltHex.getBytes(StandardCharsets.UTF_8), N, R, P, KEY_LEN);
    return "scrypt:" + saltHex + ":" + toHex(derived);
  }

  public boolean verify(String password, String stored) {
    if (stored == null) return false;
    String[] parts = stored.split(":");
    if (parts.length != 3 || !"scrypt".equals(parts[0])) return false;
    String saltHex = parts[1];
    byte[] expected = fromHex(parts[2]);
    byte[] actual = scrypt(password.getBytes(StandardCharsets.UTF_8),
        saltHex.getBytes(StandardCharsets.UTF_8), N, R, P, expected.length);
    return MessageDigest.isEqual(expected, actual);
  }

  // ---- scrypt (RFC 7914) --------------------------------------------------

  static byte[] scrypt(byte[] password, byte[] salt, int n, int r, int p, int dkLen) {
    if (n < 2 || (n & (n - 1)) != 0) throw new IllegalArgumentException("N must be a power of 2 > 1");
    int mfLen = 128 * r;
    byte[] b = pbkdf2HmacSha256(password, salt, 1, p * mfLen);
    int[] bInt = new int[b.length / 4];
    for (int i = 0; i < bInt.length; i++) {
      bInt[i] = (b[i * 4] & 0xff) | ((b[i * 4 + 1] & 0xff) << 8)
          | ((b[i * 4 + 2] & 0xff) << 16) | ((b[i * 4 + 3] & 0xff) << 24);
    }
    int words = 32 * r;
    for (int i = 0; i < p; i++) {
      sMix(bInt, i * words, n, r);
    }
    for (int i = 0; i < bInt.length; i++) {
      b[i * 4] = (byte) (bInt[i]);
      b[i * 4 + 1] = (byte) (bInt[i] >>> 8);
      b[i * 4 + 2] = (byte) (bInt[i] >>> 16);
      b[i * 4 + 3] = (byte) (bInt[i] >>> 24);
    }
    return pbkdf2HmacSha256(password, b, 1, dkLen);
  }

  private static void sMix(int[] b, int bi, int n, int r) {
    int words = 32 * r;
    int[] x = Arrays.copyOfRange(b, bi, bi + words);
    int[] v = new int[words * n];
    for (int i = 0; i < n; i++) {
      System.arraycopy(x, 0, v, i * words, words);
      blockMix(x, r);
    }
    for (int i = 0; i < n; i++) {
      int j = x[(2 * r - 1) * 16] & (n - 1);
      for (int k = 0; k < words; k++) x[k] ^= v[j * words + k];
      blockMix(x, r);
    }
    System.arraycopy(x, 0, b, bi, words);
  }

  private static void blockMix(int[] b, int r) {
    int[] x = Arrays.copyOfRange(b, (2 * r - 1) * 16, (2 * r - 1) * 16 + 16);
    int[] out = new int[b.length];
    for (int i = 0; i < 2 * r; i++) {
      for (int k = 0; k < 16; k++) x[k] ^= b[i * 16 + k];
      salsa20_8(x);
      int destOff = (i / 2 + (i % 2) * r) * 16;
      System.arraycopy(x, 0, out, destOff, 16);
    }
    System.arraycopy(out, 0, b, 0, b.length);
  }

  private static void salsa20_8(int[] b) {
    int[] x = Arrays.copyOf(b, 16);
    for (int i = 0; i < 8; i += 2) {
      x[4] ^= Integer.rotateLeft(x[0] + x[12], 7);
      x[8] ^= Integer.rotateLeft(x[4] + x[0], 9);
      x[12] ^= Integer.rotateLeft(x[8] + x[4], 13);
      x[0] ^= Integer.rotateLeft(x[12] + x[8], 18);
      x[9] ^= Integer.rotateLeft(x[5] + x[1], 7);
      x[13] ^= Integer.rotateLeft(x[9] + x[5], 9);
      x[1] ^= Integer.rotateLeft(x[13] + x[9], 13);
      x[5] ^= Integer.rotateLeft(x[1] + x[13], 18);
      x[14] ^= Integer.rotateLeft(x[10] + x[6], 7);
      x[2] ^= Integer.rotateLeft(x[14] + x[10], 9);
      x[6] ^= Integer.rotateLeft(x[2] + x[14], 13);
      x[10] ^= Integer.rotateLeft(x[6] + x[2], 18);
      x[3] ^= Integer.rotateLeft(x[15] + x[11], 7);
      x[7] ^= Integer.rotateLeft(x[3] + x[15], 9);
      x[11] ^= Integer.rotateLeft(x[7] + x[3], 13);
      x[15] ^= Integer.rotateLeft(x[11] + x[7], 18);
      x[1] ^= Integer.rotateLeft(x[0] + x[3], 7);
      x[2] ^= Integer.rotateLeft(x[1] + x[0], 9);
      x[3] ^= Integer.rotateLeft(x[2] + x[1], 13);
      x[0] ^= Integer.rotateLeft(x[3] + x[2], 18);
      x[6] ^= Integer.rotateLeft(x[5] + x[4], 7);
      x[7] ^= Integer.rotateLeft(x[6] + x[5], 9);
      x[4] ^= Integer.rotateLeft(x[7] + x[6], 13);
      x[5] ^= Integer.rotateLeft(x[4] + x[7], 18);
      x[11] ^= Integer.rotateLeft(x[10] + x[9], 7);
      x[8] ^= Integer.rotateLeft(x[11] + x[10], 9);
      x[9] ^= Integer.rotateLeft(x[8] + x[11], 13);
      x[10] ^= Integer.rotateLeft(x[9] + x[8], 18);
      x[12] ^= Integer.rotateLeft(x[15] + x[14], 7);
      x[13] ^= Integer.rotateLeft(x[12] + x[15], 9);
      x[14] ^= Integer.rotateLeft(x[13] + x[12], 13);
      x[15] ^= Integer.rotateLeft(x[14] + x[13], 18);
    }
    for (int i = 0; i < 16; i++) b[i] += x[i];
  }

  private static byte[] pbkdf2HmacSha256(byte[] password, byte[] salt, int iterations, int dkLen) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(password, "HmacSHA256"));
      int hLen = mac.getMacLength();
      int blocks = (dkLen + hLen - 1) / hLen;
      byte[] out = new byte[dkLen];
      byte[] block = new byte[salt.length + 4];
      System.arraycopy(salt, 0, block, 0, salt.length);
      int offset = 0;
      for (int i = 1; i <= blocks; i++) {
        block[salt.length] = (byte) (i >>> 24);
        block[salt.length + 1] = (byte) (i >>> 16);
        block[salt.length + 2] = (byte) (i >>> 8);
        block[salt.length + 3] = (byte) i;
        byte[] u = mac.doFinal(block);
        byte[] t = u.clone();
        for (int j = 1; j < iterations; j++) {
          u = mac.doFinal(u);
          for (int k = 0; k < t.length; k++) t[k] ^= u[k];
        }
        int len = Math.min(hLen, dkLen - offset);
        System.arraycopy(t, 0, out, offset, len);
        offset += len;
      }
      return out;
    } catch (GeneralSecurityException e) {
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

  static byte[] fromHex(String hex) {
    int len = hex.length();
    byte[] out = new byte[len / 2];
    for (int i = 0; i < len; i += 2) {
      out[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4)
          + Character.digit(hex.charAt(i + 1), 16));
    }
    return out;
  }
}
