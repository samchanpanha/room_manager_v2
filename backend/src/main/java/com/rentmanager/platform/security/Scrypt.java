package com.rentmanager.platform.security;

import java.security.GeneralSecurityException;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

/**
 * Pure-Java RFC 7914 scrypt, dependency-free implementation used only to verify
 * passwords that the Next.js app hashed with {@code crypto.scryptSync}.
 *
 * <p>Node hashes are {@code scrypt:<saltHex>:<hashHex>} where {@code saltHex} is
 * the UTF-8 string that was passed to scryptSync as the salt (not its hex-decoded
 * bytes) and the digest is 64 bytes. Only PBKDF2-HMAC-SHA256 + Salsa20/8 are
 * needed, so a sidecar implementation is simpler than dragging in Bouncy Castle.
 *
 * <p>Correctness is pinned by {@link PasswordHasherTest} against vectors produced
 * by {@code node:crypto} in the Next app itself.
 */
public final class Scrypt {

  private Scrypt() {}

  /**
   * scrypt(P, S, N, r, p, dkLen) per RFC 7914 §5.
   *
   * @param N    CPU/memory cost, a power of two greater than 1 (Node default 16384)
   * @param r    block size (Node default 8)
   * @param p    parallelization factor (Node default 1)
   * @param dkLen derived key length in bytes (Node default 64)
   */
  public static byte[] derive(byte[] password, byte[] salt, int n, int r, int p, int dkLen) {
    if (n <= 1 || (n & (n - 1)) != 0) {
      throw new IllegalArgumentException("N must be a power of two greater than 1");
    }
    if (r <= 0 || p <= 0) {
      throw new IllegalArgumentException("r and p must be positive");
    }
    int blockSize = 128 * r;
    byte[] b = pbkdf2(password, salt, 1, p * blockSize);
    for (int i = 0; i < p; i++) {
      scryptRomix(b, i * blockSize, blockSize, n, r);
    }
    return pbkdf2(password, b, 1, dkLen);
  }

  /** ROMix with the integerify rule of RFC 7914 §5 (last 64 bytes, little-endian). */
  private static void scryptRomix(byte[] b, int off, int len, int n, int r) {
    byte[] x = new byte[len];
    System.arraycopy(b, off, x, 0, len);
    byte[][] v = new byte[n][len];
    for (int i = 0; i < n; i++) {
      System.arraycopy(x, 0, v[i], 0, len);
      blockMix(x, r);
    }
    for (int i = 0; i < n; i++) {
      int j = integerify(x) & (n - 1);
      for (int k = 0; k < len; k++) {
        x[k] ^= v[j][k];
      }
      blockMix(x, r);
    }
    System.arraycopy(x, 0, b, off, len);
  }

  /** BlockMix (RFC 7914 §5), operating in place on {@code b} (128*r bytes). */
  private static void blockMix(byte[] b, int r) {
    byte[] out = new byte[b.length];
    byte[] x = new byte[64];
    System.arraycopy(b, b.length - 64, x, 0, 64);
    for (int i = 0; i < 2 * r; i++) {
      for (int k = 0; k < 64; k++) {
        x[k] ^= b[i * 64 + k];
      }
      salsa208(x);
      System.arraycopy(x, 0, out, i * 64, 64);
    }
    int off = 0;
    for (int i = 0; i < 2 * r; i += 2) {
      System.arraycopy(out, i * 64, b, off, 64);
      off += 64;
    }
    for (int i = 1; i < 2 * r; i += 2) {
      System.arraycopy(out, i * 64, b, off, 64);
      off += 64;
    }
  }

  /** Salsa20/8 core over a 64-byte block (16 little-endian words). */
  private static void salsa208(byte[] b) {
    int[] x = new int[16];
    for (int i = 0; i < 16; i++) {
      x[i] = (b[4 * i] & 0xff)
          | ((b[4 * i + 1] & 0xff) << 8)
          | ((b[4 * i + 2] & 0xff) << 16)
          | ((b[4 * i + 3] & 0xff) << 24);
    }
    int[] x0 = x.clone();
    for (int i = 0; i < 4; i++) {
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
    for (int i = 0; i < 16; i++) {
      int v = x[i] + x0[i];
      b[4 * i] = (byte) v;
      b[4 * i + 1] = (byte) (v >>> 8);
      b[4 * i + 2] = (byte) (v >>> 16);
      b[4 * i + 3] = (byte) (v >>> 24);
    }
  }

  /** Integerify: the last 64 bytes of {@code b} as a little-endian 64-bit value. */
  private static int integerify(byte[] b) {
    int off = b.length - 64;
    long v = 0;
    for (int i = 0; i < 8; i++) {
      v |= ((long) (b[off + i] & 0xff)) << (8 * i);
    }
    return (int) (v & 0x7fffffffL);
  }

  private static byte[] pbkdf2(byte[] password, byte[] salt, int iterations, int dkLen) {
    try {
      PBEKeySpec spec = new PBEKeySpec(
          asChars(password), salt, iterations, dkLen * 8);
      return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
          .generateSecret(spec).getEncoded();
    } catch (GeneralSecurityException e) {
      throw new IllegalStateException("PBKDF2WithHmacSHA256 unavailable", e);
    }
  }

  private static char[] asChars(byte[] bytes) {
    char[] chars = new char[bytes.length];
    for (int i = 0; i < bytes.length; i++) {
      chars[i] = (char) (bytes[i] & 0xff);
    }
    return chars;
  }
}