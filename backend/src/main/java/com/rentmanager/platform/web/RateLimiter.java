package com.rentmanager.platform.web;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Naive in-memory sliding-window rate limiter (per-process) — the Java port of
 * {@code src/lib/ratelimit.ts}. Used by the public M13 QR endpoints and the
 * payment webhook. M27 hardens this into a shared store; per-process is fine for
 * the single-instance install today.
 */
@Component
public class RateLimiter {

  private final Map<String, Deque<Long>> buckets = new ConcurrentHashMap<>();

  /** @return {@code true} when the hit is allowed, {@code false} when limited. */
  public boolean allow(String key, int limit, long windowMs) {
    long now = System.currentTimeMillis();
    Deque<Long> hits = buckets.computeIfAbsent(key, k -> new ArrayDeque<>());
    synchronized (hits) {
      while (!hits.isEmpty() && now - hits.peekFirst() >= windowMs) {
        hits.pollFirst();
      }
      if (hits.size() >= limit) return false;
      hits.addLast(now);
      return true;
    }
  }
}
