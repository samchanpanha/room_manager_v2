package com.rentmanager.kernel;

import java.security.SecureRandom;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Collision-resistant, roughly sortable string IDs compatible with the cuid()
 * values Prisma already stored (prefix {@code c}, base-36, ~25 chars).
 *
 * <p>We keep String PKs so new backend-created rows interleave with existing
 * Prisma rows and the frontend's IDs stay stable across the migration.
 */
public final class Cuid {

  private static final SecureRandom RANDOM = new SecureRandom();
  private static final AtomicInteger COUNTER = new AtomicInteger(RANDOM.nextInt(36 * 36 * 36 * 36));
  private static final int BLOCK = 4;
  private static final String FINGERPRINT = block(Math.abs(hostFingerprint()));

  private Cuid() {}

  public static String generate() {
    String timestamp = pad(Long.toString(System.currentTimeMillis(), 36), 8);
    String counter = pad(Integer.toString(COUNTER.getAndIncrement() % (36 * 36 * 36 * 36), 36), BLOCK);
    String random = block(RANDOM.nextInt()) + block(RANDOM.nextInt());
    return "c" + timestamp + counter + FINGERPRINT + random;
  }

  private static String block(int value) {
    return pad(Integer.toString(Math.abs(value), 36), BLOCK).substring(0, BLOCK);
  }

  private static String pad(String s, int size) {
    if (s.length() >= size) return s.substring(s.length() - size);
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < size - s.length(); i++) sb.append('0');
    return sb.append(s).toString();
  }

  private static int hostFingerprint() {
    try {
      return (java.net.InetAddress.getLocalHost().getHostName().hashCode()
              + (int) ProcessHandle.current().pid());
    } catch (Exception e) {
      return RANDOM.nextInt();
    }
  }
}
