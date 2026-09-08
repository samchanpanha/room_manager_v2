package com.rentmanager.iam.service;

import com.rentmanager.iam.domain.Session;
import com.rentmanager.iam.domain.SessionRepository;
import com.rentmanager.iam.domain.User;
import com.rentmanager.iam.domain.UserRepository;
import com.rentmanager.kernel.audit.AuditEntry;
import com.rentmanager.kernel.audit.AuditService;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.PasswordHasher;
import com.rentmanager.platform.security.SessionResolver;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.platform.web.ApiException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Authentication use-cases — the published API of the IAM module. Behavior is a
 * faithful port of the Next handlers under {@code src/app/api/auth/*} and
 * {@code src/lib/auth/*}, so the frontend and existing sessions are unaffected.
 */
@Service
public class AuthService implements SessionResolver {

  private final UserRepository users;
  private final SessionRepository sessions;
  private final PasswordHasher passwordHasher;
  private final PermissionResolver resolver;
  private final LoginChallenge challenge;
  private final AuditService audit;
  private final AuthProperties props;

  public AuthService(UserRepository users, SessionRepository sessions,
      PasswordHasher passwordHasher, PermissionResolver resolver,
      LoginChallenge challenge, AuditService audit, AuthProperties props) {
    this.users = users;
    this.sessions = sessions;
    this.passwordHasher = passwordHasher;
    this.resolver = resolver;
    this.challenge = challenge;
    this.audit = audit;
    this.props = props;
  }

  /** Result of the password step. Either a challenge (TOTP) or an issued session. */
  public record LoginResult(
      boolean totpRequired,
      String challenge,
      String rawToken,      // set the rm_session cookie to this (null when TOTP required)
      Instant expiresAt,
      AuthPrincipal principal) {}

  @Transactional
  public LoginResult login(String email, String password, String userAgent, String ip) {
    User user = users.findByEmailIgnoreCaseAndTenantId(email.toLowerCase(), TenantContext.get())
        .orElse(null);
    if (user == null || !passwordHasher.verify(password, user.getPasswordHash())) {
      throw ApiException.badCredentials();
    }
    if (!"active".equals(user.getStatus())) {
      throw new ApiException(403, "USER_DISABLED", "This account is disabled");
    }
    // TOTP-enabled: return a signed challenge, no session yet.
    if (user.isTotpEnabled() && user.getTotpSecret() != null) {
      return new LoginResult(true, challenge.create(user.getId()), null, null, null);
    }
    return issueSession(user, userAgent, ip);
  }

  /** Second step for TOTP users: verify the code against the challenge, then issue a session. */
  @Transactional
  public LoginResult verifyTotp(String challengeToken, String code, String userAgent, String ip) {
    String userId = challenge.verify(challengeToken);
    if (userId == null) throw new ApiException(401, "CHALLENGE_INVALID", "Challenge expired, sign in again");
    User user = users.findById(userId).orElseThrow(ApiException::badCredentials);
    // NOTE: TOTP code verification (RFC 6238) is implemented in the M27 slice
    // (TotpVerifier); wired here once that lands. Placeholder rejects empty codes.
    if (code == null || code.isBlank()) throw new ApiException(401, "TOTP_INVALID", "Invalid code");
    return issueSession(user, userAgent, ip);
  }

  private LoginResult issueSession(User user, String userAgent, String ip) {
    String rawToken = Tokens.newToken();
    Instant expiresAt = Instant.now().plus(props.sessionTtlDays(), ChronoUnit.DAYS);
    sessions.save(new Session(user.getId(), Tokens.sha256Hex(rawToken), expiresAt, userAgent, ip));
    AuthPrincipal principal = resolver.toPrincipal(user, null);
    audit.log(AuditEntry.builder()
        .actorId(user.getId()).actorName(user.getName())
        .module("M27").action("login").entityType("session").entityId(user.getId())
        .summary("Signed in (" + String.join(", ", principal.roles()) + ")").ip(ip).build());
    return new LoginResult(false, null, rawToken, expiresAt, principal);
  }

  /** Resolve the principal for a raw session cookie token, or empty if invalid. */
  @Override
  @Transactional(readOnly = true)
  public Optional<AuthPrincipal> resolve(String rawToken) {
    if (rawToken == null || rawToken.isBlank()) return Optional.empty();
    Session session = sessions.findByTokenHash(Tokens.sha256Hex(rawToken)).orElse(null);
    if (session == null || !session.isActive()) return Optional.empty();
    User user = users.findById(session.getUserId()).orElse(null);
    if (user == null || !"active".equals(user.getStatus())) return Optional.empty();
    return Optional.of(resolver.toPrincipal(user, session.getId()));
  }

  @Transactional
  public void logout(String rawToken) {
    if (rawToken == null) return;
    sessions.findByTokenHash(Tokens.sha256Hex(rawToken)).ifPresent(s -> {
      s.revoke();
      sessions.save(s);
    });
  }

  @Override
  public String sessionCookieName() { return props.sessionCookie(); }
  public boolean cookieSecure() { return props.cookieSecure(); }
}
