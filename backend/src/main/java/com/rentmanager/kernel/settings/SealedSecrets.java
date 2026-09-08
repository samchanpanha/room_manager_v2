package com.rentmanager.kernel.settings;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Authenticated secret <em>unsealing</em> (M27/M28) — the Java counterpart of
 * {@code src/lib/crypto/sealed.ts}. M28 secret-typed settings (payment
 * credentials, Telegram bot token) are stored as
 * {@code v1.<iv-b64url>.<tag-b64url>.<ct-b64url>} AES-256-GCM records under a key
 * derived from {@code SETTINGS_ENC_KEY} (SHA-256 of the key material). Both
 * stacks read the same {@code Setting} rows, so the derivation must match the
 * Next app byte-for-byte. Only reads are needed on the backend today; the M28
 * settings UI (which seals writes) is still served by Next.
 */
@Component
public class SealedSecrets {

  private final byte[] key;

  public SealedSecrets(
      @Value("${rentmanager.security.settings-enc-key:dev-settings-enc-key-change-me-32b-min}")
      String material) {
    this.key = sha256(material.getBytes(StandardCharsets.UTF_8));
  }

  /**
   * Decrypt a sealed record, or {@code null} when it is malformed, tampered, or
   * sealed under a different key (mirrors the TS {@code open()} contract).
   */
  public String open(String sealed) {
    if (sealed == null) return null;
    String[] parts = sealed.split("\\.");
    if (parts.length != 4 || !"v1".equals(parts[0])) return null;
    try {
      byte[] iv = Base64.getUrlDecoder().decode(parts[1]);
      byte[] tag = Base64.getUrlDecoder().decode(parts[2]);
      byte[] ct = Base64.getUrlDecoder().decode(parts[3]);
      // GCM in the JCE expects ciphertext||tag concatenated.
      byte[] ctAndTag = new byte[ct.length + tag.length];
      System.arraycopy(ct, 0, ctAndTag, 0, ct.length);
      System.arraycopy(tag, 0, ctAndTag, ct.length, tag.length);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"),
          new GCMParameterSpec(128, iv));
      return new String(cipher.doFinal(ctAndTag), StandardCharsets.UTF_8);
    } catch (Exception e) {
      return null; // wrong key or tampered record
    }
  }

  private static byte[] sha256(byte[] material) {
    try {
      return MessageDigest.getInstance("SHA-256").digest(material);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }
}
