package com.rentmanager.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.rentmanager.platform.security.TokenUtil;
import jakarta.servlet.http.Cookie;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * Wire-parity integration tests for the auth slice against a real Postgres
 * (rentmanager_test): login (scrypt + audit + session cookie), TOTP challenge,
 * rate limiting, self-service account profile update, and logout revocation.
 * Users are seeded with password hashes produced by Node's
 * {@code scryptSync} (the verified reference vectors), so the exact production
 * credential path is exercised.
 *
 * <p>Run with {@code ./mvnw -Pintegration test} after refreshing the DB with
 * {@code npm run test:pg:reset}.
 */
@Tag("integration")
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:postgresql://localhost:5432/rentmanager_test",
    "spring.datasource.username=rentmanager",
    "spring.datasource.password=rentmanager"
})
class AuthApiIT {

  private static final String TENANT = "it-auth-tenant";
  private static final List<String> USER_IDS =
      List.of("it-user-alice", "it-user-otp", "it-user-disabled");
  private static final List<String> ROLE_IDS =
      List.of("it-role-agent", "it-role-auditor");

  /** Node scryptSync output, password "Correct Horse Battery Staple", string salt "0123456789abcdef". */
  private static final String ALICE_HASH =
      "scrypt:0123456789abcdef:f19ec3c4c99708ce911678e385c79e0d3e2bfc2e15c6552a46d640b506524b8ea1dcb8a05ff3da1cfc160c793f35b088a8c3e3aa9f1c9dd544f288929e0bb671";
  /** Node scryptSync output, password "p@ss#123", string salt "f0bd6c3bb4f5e21e". */
  private static final String OTP_HASH =
      "scrypt:f0bd6c3bb4f5e21e:46a277d6ba36a1058624c65d1ee42cbeefce6305aea8a17c7fd46983da6c633797729cae405df4b70ca68a46ca5035de68a5ea80de1e0d118c5e5ffdd90d890a";

  @Autowired private MockMvc mockMvc;
  @Autowired private JdbcTemplate jdbc;

  @BeforeEach
  void seed() {
    Instant now = Instant.now();
    jdbc.update("""
        INSERT INTO "Tenant" ("id","slug","name","status","createdAt","updatedAt")
        VALUES (?, 'it-auth-tenant', 'IT Auth Tenant', 'active', ?, ?)
        """, TENANT, ts(now), ts(now));

    jdbc.update("""
        INSERT INTO "Role" ("id","key","name","description","isSystem","isProtected","createdAt")
        VALUES (?, 'AGENT', 'IT Agent', NULL, false, false, ?)
        """, "it-role-agent", ts(now));
    // Note: the Prisma seed already creates an ADMIN role, so the admin-flavored
    // scratch role must use a non-colliding key like AUDITOR.
    jdbc.update("""
        INSERT INTO "Role" ("id","key","name","description","isSystem","isProtected","createdAt")
        VALUES (?, 'AUDITOR', 'IT Auditor', NULL, false, false, ?)
        """, "it-role-auditor", ts(now));

    insertUser("it-user-alice", "alice-auth@it.local", "IT Alice Auth", ALICE_HASH,
        "active", false, null, now);
    insertUser("it-user-otp", "otp-auth@it.local", "IT Otp", OTP_HASH,
        "active", true, "sealed", now);
    insertUser("it-user-disabled", "disabled-auth@it.local", "IT Disabled", ALICE_HASH,
        "disabled", false, null, now);

    jdbc.update("""
        INSERT INTO "UserRole" ("userId","roleId","assignedAt") VALUES (?, ?, ?)
        """, "it-user-alice", "it-role-agent", ts(now));
    jdbc.update("""
        INSERT INTO "UserRole" ("userId","roleId","assignedAt") VALUES (?, ?, ?)
        """, "it-user-otp", "it-role-auditor", ts(now));
    jdbc.update("""
        INSERT INTO "UserRole" ("userId","roleId","assignedAt") VALUES (?, ?, ?)
        """, "it-user-disabled", "it-role-agent", ts(now));
  }

  private void insertUser(String id, String email, String name, String hash,
      String status, boolean totpEnabled, String totpSecret, Instant now) {
    jdbc.update("""
        INSERT INTO "User"
          ("id","tenantId","email","name","passwordHash","status","totpEnabled",
           "totpSecret","mustChangePassword","createdAt","updatedAt")
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, false, ?, ?)
        """, id, TENANT, email, name, hash, status, totpEnabled, totpSecret, ts(now), ts(now));
  }

  @AfterEach
  void cleanup() {
    String uid = idList(USER_IDS);
    jdbc.update("DELETE FROM \"Session\" WHERE \"userId\" IN " + uid);
    jdbc.update("DELETE FROM \"UserRole\" WHERE \"userId\" IN " + uid);
    jdbc.update("DELETE FROM \"AuditLog\" WHERE \"actorId\" IN " + uid);
    jdbc.update("DELETE FROM \"User\" WHERE \"id\" IN " + uid);
    jdbc.update("DELETE FROM \"Role\" WHERE \"id\" IN " + idList(ROLE_IDS));
    jdbc.update("DELETE FROM \"Tenant\" WHERE \"id\" = '" + TENANT + "'");
  }

  // ───────────────────────────── login ─────────────────────────────

  @Test
  void loginSuccessCreatesSessionCookieAndAudit() throws Exception {
    MvcResult result = mockMvc.perform(post("/api/auth/login")
            .header("x-forwarded-for", "198.51.100.10")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"ALICE-AUTH@it.local\",\"password\":\"Correct Horse Battery Staple\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value("it-user-alice"))
        .andExpect(jsonPath("$.name").value("IT Alice Auth"))
        .andExpect(jsonPath("$.email").value("alice-auth@it.local"))
        .andExpect(jsonPath("$.roles[0]").value("AGENT"))
        .andExpect(jsonPath("$.totpEnrollmentRequired").value(false))
        .andExpect(jsonPath("$.mustChangePassword").value(false))
        .andExpect(jsonPath("$.totpRequired").doesNotExist())
        .andReturn();

    String cookie = extractSessionCookie(result);
    org.junit.jupiter.api.Assertions.assertTrue(cookie.startsWith("rm_session="));

    String tokenHash = TokenUtil.sha256Hex(cookieValue(cookie));
    Map<String, Object> session = jdbc.queryForMap("""
        SELECT "expiresAt", "revokedAt", "userId" FROM "Session" WHERE "tokenHash" = ?
        """, tokenHash);
    org.junit.jupiter.api.Assertions.assertEquals("it-user-alice", session.get("userId"));
    org.junit.jupiter.api.Assertions.assertNull(session.get("revokedAt"));
    // Default SESSION_TTL_DAYS=30.
    Instant expiresAt = ((Timestamp) session.get("expiresAt")).toInstant();
    org.junit.jupiter.api.Assertions.assertTrue(expiresAt.isAfter(Instant.now().plus(29, ChronoUnit.DAYS)));

    Map<String, Object> audit = jdbc.queryForMap("""
        SELECT "module","action","entityType","entityId","summary","ip","hash"
        FROM "AuditLog" WHERE "actorId" = 'it-user-alice' AND "action" = 'login'
        ORDER BY "createdAt" DESC LIMIT 1
        """);
    org.junit.jupiter.api.Assertions.assertEquals("M27", audit.get("module"));
    org.junit.jupiter.api.Assertions.assertEquals("session", audit.get("entityType"));
    org.junit.jupiter.api.Assertions.assertEquals("it-user-alice", audit.get("entityId"));
    org.junit.jupiter.api.Assertions.assertEquals("Signed in (AGENT)", audit.get("summary"));
    org.junit.jupiter.api.Assertions.assertEquals("198.51.100.10", audit.get("ip"));
    org.junit.jupiter.api.Assertions.assertNotNull(audit.get("hash"));
    org.junit.jupiter.api.Assertions.assertEquals(64, ((String) audit.get("hash")).length());
  }

  @Test
  void loginWithWrongPasswordOrEmailReturnsBadCredentials() throws Exception {
    String body = "{\"email\":\"alice-auth@it.local\",\"password\":\"not-the-password\"}";
    mockMvc.perform(post("/api/auth/login")
            .header("x-forwarded-for", "198.51.100.20")
            .contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("BAD_CREDENTIALS"))
        .andExpect(jsonPath("$.message").value("Invalid email or password"));

    mockMvc.perform(post("/api/auth/login")
            .header("x-forwarded-for", "198.51.100.21")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"nobody@it.local\",\"password\":\"whatever\"}"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("BAD_CREDENTIALS"));

    Integer sessions = jdbc.queryForObject(
        "SELECT COUNT(*) FROM \"Session\" WHERE \"userId\" = 'it-user-alice'", Integer.class);
    org.junit.jupiter.api.Assertions.assertEquals(0, sessions);
  }

  @Test
  void loginDisabledAccountReturnsUserDisabled() throws Exception {
    mockMvc.perform(post("/api/auth/login")
            .header("x-forwarded-for", "198.51.100.30")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"disabled-auth@it.local\",\"password\":\"Correct Horse Battery Staple\"}"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.error").value("USER_DISABLED"))
        .andExpect(jsonPath("$.message").value("This account is disabled"));
  }

  @Test
  void loginTotpUserReturnsChallengeWithoutSession() throws Exception {
    MvcResult result = mockMvc.perform(post("/api/auth/login")
            .header("x-forwarded-for", "198.51.100.40")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"otp-auth@it.local\",\"password\":\"p@ss#123\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totpRequired").value(true))
        .andExpect(jsonPath("$.challenge").isNotEmpty())
        .andReturn();

    org.junit.jupiter.api.Assertions.assertNull(result.getResponse().getHeader("Set-Cookie"));

    String challenge = ((String) result.getResponse().getContentAsString())
        .replaceAll(".*\"challenge\":\"([^\"]+)\".*", "$1");
    String[] parts = challenge.split("\\.", -1);
    org.junit.jupiter.api.Assertions.assertEquals(2, parts.length);
    var payload = Base64.getUrlDecoder().decode(parts[0]);
    @SuppressWarnings("unchecked")
    Map<String, Object> json = new com.fasterxml.jackson.databind.ObjectMapper().readValue(payload, Map.class);
    org.junit.jupiter.api.Assertions.assertEquals("it-user-otp", json.get("sub"));
    org.junit.jupiter.api.Assertions.assertTrue(((Number) json.get("exp")).longValue() > System.currentTimeMillis());

    Integer sessions = jdbc.queryForObject(
        "SELECT COUNT(*) FROM \"Session\" WHERE \"userId\" = 'it-user-otp'", Integer.class);
    org.junit.jupiter.api.Assertions.assertEquals(0, sessions);
  }

  @Test
  void loginRateLimitsAfterTenAttempts() throws Exception {
    // The limiter keys on the forwarded-for first segment; 10 failures then a 429.
    for (int i = 0; i < 10; i++) {
      mockMvc.perform(post("/api/auth/login")
              .header("x-forwarded-for", "198.51.100.99")
              .contentType(MediaType.APPLICATION_JSON)
              .content("{\"email\":\"alice-auth@it.local\",\"password\":\"bad\"}"))
          .andExpect(status().isUnauthorized());
    }
    mockMvc.perform(post("/api/auth/login")
            .header("x-forwarded-for", "198.51.100.99")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"alice-auth@it.local\",\"password\":\"Correct Horse Battery Staple\"}"))
        .andExpect(status().isTooManyRequests())
        .andExpect(jsonPath("$.error").value("RATE_LIMITED"))
        .andExpect(jsonPath("$.message").value("Too many attempts, wait a minute"));
  }

  @Test
  void loginMalformedOrEmptyBodyIsHandledLikeNext() throws Exception {
    mockMvc.perform(post("/api/auth/login")
            .header("x-forwarded-for", "198.51.100.50")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{not json at all"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("INVALID_JSON"))
        .andExpect(jsonPath("$.message").value("Request body must be valid JSON"));

    mockMvc.perform(post("/api/auth/login")
            .header("x-forwarded-for", "198.51.100.51")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
        .andExpect(jsonPath("$.message").value("email: Invalid input: expected string, received undefined"));
  }

  // ───────────────────────────── account ─────────────────────────────

  @Test
  void accountPatchUpdatesNameAndAudits() throws Exception {
    String cookie = sessionCookieForAlice();

    mockMvc.perform(patch("/api/account")
            .header("x-forwarded-for", "198.51.100.60")
            .cookie(new Cookie("rm_session", tokenFrom(cookie)))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"  Patricia New Name  \"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value("it-user-alice"))
        .andExpect(jsonPath("$.name").value("Patricia New Name"));

    Map<String, Object> user = jdbc.queryForMap(
        "SELECT \"name\", \"updatedAt\" FROM \"User\" WHERE \"id\" = 'it-user-alice'");
    org.junit.jupiter.api.Assertions.assertEquals("Patricia New Name", user.get("name"));
    org.junit.jupiter.api.Assertions.assertNotNull(user.get("updatedAt"));

    Map<String, Object> audit = jdbc.queryForMap("""
        SELECT "module","action","entityType","entityId","summary","before","after"
        FROM "AuditLog" WHERE "actorId" = 'it-user-alice' AND "action" = 'update'
        ORDER BY "createdAt" DESC LIMIT 1
        """);
    org.junit.jupiter.api.Assertions.assertEquals("M01", audit.get("module"));
    org.junit.jupiter.api.Assertions.assertEquals("user", audit.get("entityType"));
    org.junit.jupiter.api.Assertions.assertEquals("it-user-alice", audit.get("entityId"));
    org.junit.jupiter.api.Assertions.assertEquals(
        "Updated own profile name to \"Patricia New Name\"", audit.get("summary"));
    org.junit.jupiter.api.Assertions.assertTrue(((String) audit.get("before"))
        .contains("IT Alice Auth"));
    org.junit.jupiter.api.Assertions.assertTrue(((String) audit.get("after"))
        .contains("Patricia New Name"));
  }

  @Test
  void accountPatchValidationMatchesZod() throws Exception {
    // Next parses/validates the body before checking the session, so a 400 wins
    // over a 401; a valid body with no session is a 401.
    mockMvc.perform(patch("/api/account")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"A\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
        .andExpect(jsonPath("$.message").value("name: String must contain at least 2 character(s)"));

    mockMvc.perform(patch("/api/account")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Patricia Unauthenticated\"}"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));

    String cookie = sessionCookieForAlice();
    mockMvc.perform(patch("/api/account")
            .cookie(new Cookie("rm_session", tokenFrom(cookie)))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
        .andExpect(jsonPath("$.message")
            .value("name: Invalid input: expected string, received undefined"));
  }

  // ───────────────────────────── logout ─────────────────────────────

  @Test
  void logoutRevokesSessionAuditsAndClearsCookie() throws Exception {
    String cookie = sessionCookieForAlice();
    String token = tokenFrom(cookie);

    mockMvc.perform(post("/api/auth/logout")
            .header("x-forwarded-for", "198.51.100.70")
            .cookie(new Cookie("rm_session", token)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.signedOut").value(true));

    // The same cookie no longer authenticates (send a valid body — an empty
    // PATCH body would fail validation before the session is ever checked).
    mockMvc.perform(patch("/api/account")
            .cookie(new Cookie("rm_session", token))
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Even More Patricia\"}"))
        .andExpect(status().isUnauthorized());

    String tokenHash = TokenUtil.sha256Hex(token);
    Map<String, Object> session = jdbc.queryForMap(
        "SELECT \"revokedAt\" FROM \"Session\" WHERE \"tokenHash\" = ?", tokenHash);
    org.junit.jupiter.api.Assertions.assertNotNull(session.get("revokedAt"));

    Map<String, Object> audit = jdbc.queryForMap("""
        SELECT "action","entityType","entityId","summary"
        FROM "AuditLog" WHERE "actorId" = 'it-user-alice' AND "action" = 'logout'
        ORDER BY "createdAt" DESC LIMIT 1
        """);
    org.junit.jupiter.api.Assertions.assertEquals("session", audit.get("entityType"));
    org.junit.jupiter.api.Assertions.assertEquals("it-user-alice", audit.get("entityId"));
    org.junit.jupiter.api.Assertions.assertEquals("Signed out", audit.get("summary"));
  }

  @Test
  void logoutWithoutSessionStillSucceeds() throws Exception {
    mockMvc.perform(post("/api/auth/logout").header("x-forwarded-for", "198.51.100.71"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.signedOut").value(true));
  }

  // ───────────────────────────── helpers ─────────────────────────────

  /** Performs a fresh login as alice and returns the raw {@code Set-Cookie} header. */
  private String sessionCookieForAlice() throws Exception {
    MvcResult result = mockMvc.perform(post("/api/auth/login")
            .header("x-forwarded-for", "198.51.100.10")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"email\":\"alice-auth@it.local\",\"password\":\"Correct Horse Battery Staple\"}"))
        .andExpect(status().isOk())
        .andReturn();
    return extractSessionCookie(result);
  }

  private static String extractSessionCookie(MvcResult result) {
    String setCookie = result.getResponse().getHeader("Set-Cookie");
    org.junit.jupiter.api.Assertions.assertNotNull(setCookie, "expected a Set-Cookie header");
    for (String part : setCookie.split(",")) {
      if (part.trim().startsWith("rm_session=")) return part.trim();
    }
    throw new AssertionError("no rm_session cookie in: " + setCookie);
  }

  private static String tokenFrom(String sessionCookie) {
    return sessionCookie.substring("rm_session=".length(), sessionCookie.indexOf(';'));
  }

  private static String cookieValue(String sessionCookie) {
    return sessionCookie.split("=", 2)[1].split(";", 2)[0];
  }

  private static String idList(List<String> ids) {
    return "(" + String.join(", ", ids.stream().map(id -> "'" + id + "'").toList()) + ")";
  }

  private static Timestamp ts(Instant instant) {
    return Timestamp.from(instant);
  }
}