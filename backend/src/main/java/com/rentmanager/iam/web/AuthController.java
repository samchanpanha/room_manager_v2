package com.rentmanager.iam.web;

import com.rentmanager.iam.dto.AccountResponse;
import com.rentmanager.iam.dto.LoginRequest;
import com.rentmanager.iam.dto.VerifyTotpRequest;
import com.rentmanager.iam.service.AuthService;
import com.rentmanager.iam.service.AuthService.LoginResult;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.platform.web.ApiException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Auth endpoints mirroring {@code src/app/api/auth/*} and {@code /api/account}.
 * Sets the same {@code rm_session} cookie the Next app sets so sessions are
 * interchangeable between the two stacks during migration.
 */
@RestController
public class AuthController {

  private final AuthService auth;
  private final CurrentUser currentUser;

  public AuthController(AuthService auth, CurrentUser currentUser) {
    this.auth = auth;
    this.currentUser = currentUser;
  }

  @PostMapping("/api/auth/login")
  public ResponseEntity<?> login(
      @Valid @RequestBody LoginRequest body, HttpServletRequest req, HttpServletResponse res) {
    LoginResult result = auth.login(body.email(), body.password(),
        req.getHeader("User-Agent"), clientIp(req));
    if (result.totpRequired()) {
      return ResponseEntity.ok(Map.of("totpRequired", true, "challenge", result.challenge()));
    }
    setSessionCookie(res, result.rawToken(), result.expiresAt());
    return ResponseEntity.ok(loginBody(result.principal()));
  }

  @PostMapping("/api/auth/login/verify")
  public ResponseEntity<?> verify(
      @Valid @RequestBody VerifyTotpRequest body, HttpServletRequest req, HttpServletResponse res) {
    LoginResult result = auth.verifyTotp(body.challenge(), body.code(),
        req.getHeader("User-Agent"), clientIp(req));
    setSessionCookie(res, result.rawToken(), result.expiresAt());
    return ResponseEntity.ok(loginBody(result.principal()));
  }

  @PostMapping("/api/auth/logout")
  public ResponseEntity<?> logout(HttpServletRequest req, HttpServletResponse res) {
    auth.logout(readCookie(req, auth.sessionCookieName()));
    clearSessionCookie(res);
    return ResponseEntity.ok(Map.of("ok", true));
  }

  @GetMapping("/api/account")
  public AccountResponse account() {
    AuthPrincipal user = currentUser.getOrNull();
    if (user == null) throw ApiException.unauthenticated();
    return AccountResponse.from(user);
  }

  // ---- helpers ------------------------------------------------------------

  private Map<String, Object> loginBody(AuthPrincipal p) {
    Map<String, Object> m = new LinkedHashMap<>();
    m.put("id", p.id());
    m.put("name", p.name());
    m.put("email", p.email());
    m.put("roles", p.roles());
    m.put("totpEnrollmentRequired", p.totpEnrollmentRequired());
    m.put("mustChangePassword", p.mustChangePassword());
    return m;
  }

  private void setSessionCookie(HttpServletResponse res, String token, Instant expiresAt) {
    Cookie cookie = new Cookie(auth.sessionCookieName(), token);
    cookie.setHttpOnly(true);
    cookie.setSecure(auth.cookieSecure());
    cookie.setPath("/");
    cookie.setAttribute("SameSite", "Lax");
    long maxAge = Math.max(0, (expiresAt.toEpochMilli() - System.currentTimeMillis()) / 1000);
    cookie.setMaxAge((int) maxAge);
    res.addCookie(cookie);
  }

  private void clearSessionCookie(HttpServletResponse res) {
    Cookie cookie = new Cookie(auth.sessionCookieName(), "");
    cookie.setHttpOnly(true);
    cookie.setPath("/");
    cookie.setMaxAge(0);
    res.addCookie(cookie);
  }

  private static String readCookie(HttpServletRequest req, String name) {
    if (req.getCookies() == null) return null;
    for (Cookie c : req.getCookies()) if (name.equals(c.getName())) return c.getValue();
    return null;
  }

  private static String clientIp(HttpServletRequest req) {
    String fwd = req.getHeader("X-Forwarded-For");
    if (fwd != null && !fwd.isBlank()) return fwd.split(",")[0].trim();
    String real = req.getHeader("X-Real-IP");
    return real != null ? real : req.getRemoteAddr();
  }
}
