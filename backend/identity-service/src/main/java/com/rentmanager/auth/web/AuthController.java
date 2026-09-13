package com.rentmanager.auth.web;

import com.rentmanager.auth.service.ChallengeService;
import com.rentmanager.kernel.domain.User;
import com.rentmanager.kernel.domain.UserRepository;
import com.rentmanager.kernel.service.AuditService;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.platform.security.PasswordHasher;
import com.rentmanager.platform.security.SessionLifecycle;
import com.rentmanager.platform.web.ApiException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Wire-compatible port of {@code POST /api/auth/login} and
 * {@code POST /api/auth/logout} (src/app/api/auth/login/route.ts,
 * src/app/api/auth/logout/route.ts): login rate limit, scrypt verification,
 * optional TOTP challenge, session cookie + M27 audit, logout revocation.
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

  private static final Pattern EMAIL_RE =
      Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
  private static final String SESSION_COOKIE = "rm_session";

  private final UserRepository users;
  private final SessionLifecycle sessionLifecycle;
  private final AuditService audit;
  private final ChallengeService challenges;
  private final CurrentUser currentUser;
  private final Environment env;

  private final Map<String, List<Long>> attempts = new java.util.concurrent.ConcurrentHashMap<>();

  public AuthController(UserRepository users, SessionLifecycle sessionLifecycle,
      AuditService audit, ChallengeService challenges, CurrentUser currentUser, Environment env) {
    this.users = users;
    this.sessionLifecycle = sessionLifecycle;
    this.audit = audit;
    this.challenges = challenges;
    this.currentUser = currentUser;
    this.env = env;
  }

  @PostMapping("/login")
  public Map<String, Object> login(
      @RequestBody(required = false) Map<String, Object> body,
      HttpServletRequest request,
      HttpServletResponse response) {

    Map<String, Object> payload = body == null ? Map.of() : body;

    rateLimit("login:" + clientIp(request), 10, 60_000);

    Object emailValue = payload.get("email");
    Object passwordValue = payload.get("password");
    String email = requireEmail(emailValue);
    String password = requirePassword(passwordValue);

    var user = users.findByEmail(email.toLowerCase())
        .orElseThrow(() -> badCredentials());
    if (!PasswordHasher.verifyPassword(password, user.getPasswordHash())) {
      throw badCredentials();
    }
    if (!"active".equals(user.getStatus())) {
      throw new ApiException(403, "USER_DISABLED", "This account is disabled");
    }
    if (user.isTotpEnabled() && user.getTotpSecret() != null) {
      Map<String, Object> out = new LinkedHashMap<>();
      out.put("totpRequired", true);
      out.put("challenge", challenges.create(user.getId()));
      return out;
    }

    // createSession — same shape as prisma.session.create.
    String userAgent = request.getHeader("user-agent");
    SessionLifecycle.SessionIssued issued =
        sessionLifecycle.create(user.getId(), userAgent, clientIp(request));

    setSessionCookie(response, issued.rawToken(), issued.expiresAt().toEpochMilli());

    // logAudit(M27 login) — same entityType/entityId/summary as the Next handler.
    List<String> roles = rolesOf(user);
    audit.log(new AuditService.AuditInput(
        user.getTenantId(),
        user.getId(),
        user.getName(),
        "M27",
        "login",
        "session",
        user.getId(),
        "Signed in (" + String.join(", ", roles) + ")",
        null,
        null,
        clientIp(request)));

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", user.getId());
    out.put("name", user.getName());
    out.put("email", user.getEmail());
    out.put("roles", roles);
    out.put("totpEnrollmentRequired", user.isTotpEnabled() == false && isAdminPlus(roles)
        && enforceTotp());
    out.put("mustChangePassword", user.isMustChangePassword());
    return out;
  }

  @PostMapping("/logout")
  public Map<String, Object> logout(HttpServletRequest request, HttpServletResponse response) {
    // getAuthUser() → if a session exists, audit M27 logout first.
    var principal = currentUser.getOrNull();
    if (principal != null) {
      audit.log(new AuditService.AuditInput(
          principal.tenantId(),
          principal.id(),
          principal.name(),
          "M27",
          "logout",
          "session",
          principal.id(),
          "Signed out",
          null,
          null,
          clientIp(request)));
    }

    // destroyCurrentSession() → revoke the row for sha256(cookie token), then clear the cookie.
    String token = readCookie(request, SESSION_COOKIE);
    if (token != null) {
      sessionLifecycle.revoke(token);
    }
    clearSessionCookie(response);
    return Map.of("signedOut", true);
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private void rateLimit(String key, int limit, long windowMs) {
    long now = System.currentTimeMillis();
    List<Long> timestamps = attempts.computeIfAbsent(
        key, k -> new ArrayList<>());
    synchronized (timestamps) {
      timestamps.removeIf(t -> now - t >= windowMs);
      if (timestamps.size() >= limit) {
        throw new ApiException(429, "RATE_LIMITED", "Too many attempts, wait a minute");
      }
      timestamps.add(now);
    }
  }

  private static String requireEmail(Object value) {
    if (value == null) {
      throw validation("email: Invalid input: expected string, received undefined");
    }
    if (!(value instanceof String s)) {
      throw validation("email: Invalid input: expected string, received " + typeName(value));
    }
    if (!EMAIL_RE.matcher(s).matches()) {
      throw validation("email: Invalid email");
    }
    return s;
  }

  private static String requirePassword(Object value) {
    if (value == null) {
      throw validation("password: Invalid input: expected string, received undefined");
    }
    if (!(value instanceof String s)) {
      throw validation("password: Invalid input: expected string, received " + typeName(value));
    }
    if (s.isEmpty()) {
      throw validation("password: String must contain at least 1 character(s)");
    }
    return s;
  }

  private static String typeName(Object value) {
    if (value instanceof Number) return "number";
    if (value instanceof Boolean) return "boolean";
    if (value instanceof List<?>) return "array";
    if (value instanceof Map<?, ?>) return "object";
    return "null";
  }

  private static ApiException badCredentials() {
    return new ApiException(401, "BAD_CREDENTIALS", "Invalid email or password");
  }

  private static ApiException validation(String message) {
    return new ApiException(400, "VALIDATION_ERROR", message);
  }

  private static List<String> rolesOf(User user) {
    return user.getRoles().stream()
        .map(ur -> ur.getRole().getKey())
        .sorted()
        .toList();
  }

  private static boolean isAdminPlus(List<String> roles) {
    return roles.contains("SUPER_ADMIN") || roles.contains("ADMIN");
  }

  private boolean enforceTotp() {
    return "true".equals(env.getProperty("ENFORCE_MANDATORY_TOTP", "false"));
  }

  private static String clientIp(HttpServletRequest request) {
    String forwarded = request.getHeader("x-forwarded-for");
    if (forwarded != null && !forwarded.isBlank()) {
      int comma = forwarded.indexOf(',');
      return (comma >= 0 ? forwarded.substring(0, comma) : forwarded).trim();
    }
    String realIp = request.getHeader("x-real-ip");
    if (realIp != null && !realIp.isBlank()) return realIp.trim();
    return "unknown";
  }

  private void setSessionCookie(HttpServletResponse response, String token, long expiresAtMs) {
    boolean secure = "production".equals(env.getProperty("NODE_ENV", "development"))
        && !"false".equals(env.getProperty("COOKIE_SECURE"));
    response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(SESSION_COOKIE, token)
        .httpOnly(true)
        .sameSite("Lax")
        .secure(secure)
        .path("/")
        .maxAge(Duration.ofMillis(expiresAtMs - System.currentTimeMillis()))
        .build().toString());
  }

  private void clearSessionCookie(HttpServletResponse response) {
    response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(SESSION_COOKIE, "")
        .httpOnly(true)
        .sameSite("Lax")
        .path("/")
        .maxAge(0)
        .build().toString());
  }

  private static String readCookie(HttpServletRequest request, String name) {
    Cookie[] cookies = request.getCookies();
    if (cookies == null) return null;
    for (Cookie cookie : cookies) {
      if (name.equals(cookie.getName())) return cookie.getValue();
    }
    return null;
  }
}