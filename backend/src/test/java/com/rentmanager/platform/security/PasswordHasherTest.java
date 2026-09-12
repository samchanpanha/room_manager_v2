package com.rentmanager.platform.security;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Pins {@link Scrypt} / {@link PasswordHasher} to Node's {@code scryptSync} so
 * the Java side can verify hashes written by the Next app byte-for-byte.
 */
class PasswordHasherTest {

  /** RFC 7914 §11, Test vector 1 (dkLen 64) against our primitive. */
  @Test
  void matchesRfc7914Vector1() {
    byte[] dk = Scrypt.derive(
        "password".getBytes(java.nio.charset.StandardCharsets.UTF_8),
        "NaCl".getBytes(java.nio.charset.StandardCharsets.UTF_8),
        1024, 8, 16, 64);
    assertThat(hex(dk))
        .isEqualTo("fdbabe1c9d3472007856e7190d01e9fe"
            + "7c6ad7cbc8237830e77376634b373162"
            + "2eaf30d92e22a3886ff109279d9830da"
            + "c727afb94a83ee6d8360cbdfa2cc0640");
  }

  /** The two vectors generated from {@code node:crypto} for this exact stored format. */
  @Test
  void verifiesNodeGeneratedHashes() {
    // node -e "require('crypto').scryptSync('Correct Horse Battery Staple','0123456789abcdef',64)"
    assertThat(PasswordHasher.verifyPassword(
        "Correct Horse Battery Staple",
        "scrypt:0123456789abcdef:"
            + "f19ec3c4c99708ce911678e385c79e0d3e2bfc2e15c6552a46d640b506524b8e"
            + "a1dcb8a05ff3da1cfc160c793f35b088a8c3e3aa9f1c9dd544f288929e0bb671"))
        .isTrue();

    assertThat(PasswordHasher.verifyPassword(
        "p@ss#123",
        "scrypt:f0bd6c3bb4f5e21e:"
            + "46a277d6ba36a1058624c65d1ee42cbeefce6305aea8a17c7fd46983da6c633797"
            + "729cae405df4b70ca68a46ca5035de68a5ea80de1e0d118c5e5ffdd90d890a"))
        .isTrue();
  }

  @Test
  void rejectsWrongPasswordTweak() {
    assertThat(PasswordHasher.verifyPassword(
        "Correct Horse Battery Staple ",
        "scrypt:0123456789abcdef:"
            + "f19ec3c4c99708ce911678e385c79e0d3e2bfc2e15c6552a46d640b506524b8e"
            + "a1dcb8a05ff3da1cfc160c793f35b088a8c3e3aa9f1c9dd544f288929e0bb671"))
        .isFalse();
  }

  @Test
  void rejectsMalformedStoredForms() {
    assertThat(PasswordHasher.verifyPassword("x", null)).isFalse();
    assertThat(PasswordHasher.verifyPassword("x", "")).isFalse();
    assertThat(PasswordHasher.verifyPassword("x", "bcrypt:abc:def")).isFalse();
    assertThat(PasswordHasher.verifyPassword("x", "scrypt:salt:nothash")).isFalse();
    assertThat(PasswordHasher.verifyPassword("x", "scrypt:salt:zz")).isFalse(); // non-hex
  }

  @Test
  void hashRoundTrips() {
    String stored = PasswordHasher.hashPassword("round-trip-pw");
    assertThat(stored.startsWith("scrypt:")).isTrue();
    assertThat(PasswordHasher.verifyPassword("round-trip-pw", stored)).isTrue();
    assertThat(PasswordHasher.verifyPassword("round-trip-pwX", stored)).isFalse();
  }

  private static String hex(byte[] bytes) {
    StringBuilder sb = new StringBuilder(bytes.length * 2);
    for (byte b : bytes) sb.append(String.format("%02x", b));
    return sb.toString();
  }
}