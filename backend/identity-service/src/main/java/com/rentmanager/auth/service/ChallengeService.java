package com.rentmanager.auth.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Wire-compatible port of {@code createChallenge} / {@code verifyChallenge} in
 * src/lib/auth/challenge.ts: a 5-minute HMAC-SHA256 token
 * {@code base64url(payload).base64url(hmac(payload))} where the payload is
 * {@code {sub, exp, n}} and {@code n} is 6 random bytes. The signing secret
 * follows the same precedence: {@code AUTH_CHALLENGE_SECRET} →
 * {@code FILE_SIGNING_SECRET} → a per-process random dev secret.
 */
@Component
public class ChallengeService {

  static final String ALGORITHM = "HmacSHA256";
  static final long TTL_MILLIS = 5 * 60 * 1000L;

  private final Environment env;
  private final ObjectMapper objectMapper;
  private final SecureRandom random = new SecureRandom();
  private final byte[] secret;

  public ChallengeService(Environment env, ObjectMapper objectMapper) {
    this.env = env;
    this.objectMapper = objectMapper;
    this.secret = resolveSecret().getBytes(StandardCharsets.UTF_8);
  }

  public String create(String userId) {
    String n = hex(randomBytes(6));
    long exp = System.currentTimeMillis() + TTL_MILLIS;
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("sub", userId);
    payload.put("exp", exp);
    payload.put("n", n);
    try {
      String body = base64Url(objectMapper.writeValueAsBytes(payload));
      String signature = base64Url(hmac(body, secret));
      return body + "." + signature;
    } catch (Exception e) {
      throw new IllegalStateException("Failed to create challenge", e);
    }
  }

  /** Verifies shape, subject and expiry, then recomputes the HMAC. */
  public boolean verify(String token, String userId) {
    if (token == null) return false;
    String[] parts = token.split("\\.", -1);
    if (parts.length != 2) return false;
    String body = parts[0];
    String signature = parts[1];
    try {
      byte[] expected = hmac(body, secret);
      if (!MessageDigest.isEqual(base64UrlDecodeLenient(signature), expected)) return false;
      byte[] payload = Base64.getUrlDecoder().decode(body);
      Map<?, ?> json = objectMapper.readValue(payload, Map.class);
      Object sub = json.get("sub");
      Object exp = json.get("exp");
      if (!userId.equals(sub)) return false;
      if (!(exp instanceof Number n) || n.longValue() <= System.currentTimeMillis()) return false;
      return true;
    } catch (Exception e) {
      return false;
    }
  }

  private String resolveSecret() {
    String configured = firstNonBlank(
        env.getProperty("AUTH_CHALLENGE_SECRET"),
        env.getProperty("FILE_SIGNING_SECRET"));
    if (configured != null) return configured;
    return "dev-challenge-" + hex(randomBytes(16));
  }

  private static String firstNonBlank(String... candidates) {
    for (String c : candidates) {
      if (c != null && !c.isBlank()) return c;
    }
    return null;
  }

  private byte[] hmac(String body, byte[] key) {
    try {
      Mac mac = Mac.getInstance(ALGORITHM);
      mac.init(new SecretKeySpec(key, ALGORITHM));
      return mac.doFinal(body.getBytes(StandardCharsets.UTF_8));
    } catch (Exception e) {
      throw new IllegalStateException("Failed to sign challenge", e);
    }
  }

  private static String base64Url(byte[] bytes) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
  }

  /** Matches the {strict: false} base64url decoder used by the Next app. */
  private static byte[] base64UrlDecodeLenient(String value) {
    return Base64.getUrlDecoder().decode(pad(value));
  }

  private static String pad(String value) {
    int rem = value.length() % 4;
    return rem == 0 ? value : value + "=".repeat(4 - rem);
  }

  private byte[] randomBytes(int n) {
    byte[] bytes = new byte[n];
    random.nextBytes(bytes);
    return bytes;
  }

  private static String hex(byte[] bytes) {
    StringBuilder sb = new StringBuilder(bytes.length * 2);
    for (byte b : bytes) sb.append(String.format("%02x", b));
    return sb.toString();
  }
}