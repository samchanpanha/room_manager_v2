package com.rentmanager.iam.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;

/**
 * Short-lived, HMAC-signed challenge issued after the password step for
 * TOTP-enabled users (mirrors {@code src/lib/auth/challenge.ts}). Format:
 * {@code base64url(userId.expiresAtMillis).base64url(hmac)}.
 */
@Component
public class LoginChallenge {

  private static final long TTL_MS = 5 * 60 * 1000;
  private final byte[] secret;

  public LoginChallenge(AuthProperties props) {
    this.secret = props.challengeSecret().getBytes(StandardCharsets.UTF_8);
  }

  public String create(String userId) {
    long exp = System.currentTimeMillis() + TTL_MS;
    String payload = userId + "." + exp;
    String body = b64(payload.getBytes(StandardCharsets.UTF_8));
    return body + "." + b64(hmac(body));
  }

  /** @return the userId if the challenge is valid and unexpired, else null. */
  public String verify(String challenge) {
    if (challenge == null) return null;
    int dot = challenge.lastIndexOf('.');
    if (dot < 0) return null;
    String body = challenge.substring(0, dot);
    String sig = challenge.substring(dot + 1);
    if (!MessageDigest.isEqual(b64(hmac(body)).getBytes(StandardCharsets.UTF_8),
        sig.getBytes(StandardCharsets.UTF_8))) {
      return null;
    }
    String payload = new String(Base64.getUrlDecoder().decode(body), StandardCharsets.UTF_8);
    int sep = payload.lastIndexOf('.');
    if (sep < 0) return null;
    long exp = Long.parseLong(payload.substring(sep + 1));
    if (System.currentTimeMillis() > exp) return null;
    return payload.substring(0, sep);
  }

  private byte[] hmac(String body) {
    try {
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret, "HmacSHA256"));
      return mac.doFinal(body.getBytes(StandardCharsets.UTF_8));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private static String b64(byte[] b) {
    return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
  }
}
