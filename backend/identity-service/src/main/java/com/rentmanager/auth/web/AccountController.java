package com.rentmanager.auth.web;

import com.rentmanager.kernel.service.AccountService;
import com.rentmanager.kernel.service.AuditService;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.platform.web.ApiException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Wire-compatible port of {@code PATCH /api/account} (src/app/api/account/route.ts):
 * zod name validation (2..120 on the raw value, then trimmed for storage), M01
 * profile-audit, and the {@code {id, name}} response.
 */
@RestController
@RequestMapping("/api/account")
public class AccountController {

  private final AccountService accountService;
  private final AuditService audit;
  private final CurrentUser currentUser;

  public AccountController(AccountService accountService, AuditService audit, CurrentUser currentUser) {
    this.accountService = accountService;
    this.audit = audit;
    this.currentUser = currentUser;
  }

  @PatchMapping
  public Map<String, Object> updateName(
      @RequestBody(required = false) Map<String, Object> body,
      HttpServletRequest request) {

    Map<String, Object> payload = body == null ? Map.of() : body;
    // parseBody runs BEFORE getAuthUser in the Next route (400 validation beats 401).
    String name = requireName(payload.get("name"));
    String trimmed = name.trim();

    AuthPrincipal user = currentUser.require();

    boolean updated = accountService.updateName(user.id(), trimmed);

    audit.log(new AuditService.AuditInput(
        user.tenantId(),
        user.id(),
        user.name(),
        "M01",
        "update",
        "user",
        user.id(),
        "Updated own profile name to \"" + trimmed + "\"",
        Map.of("name", user.name()),
        Map.of("name", trimmed),
        clientIp(request)));

    Map<String, Object> out = new LinkedHashMap<>();
    out.put("id", user.id());
    out.put("name", updated ? trimmed : user.name());
    return out;
  }

  /** Mirror of {@code z.string().min(2).max(120)} run against the raw value. */
  private static String requireName(Object value) {
    if (value == null) {
      throw ApiException.validation("name: Invalid input: expected string, received undefined");
    }
    if (!(value instanceof String s)) {
      throw ApiException.validation("name: Invalid input: expected string, received " + typeName(value));
    }
    if (s.length() < 2) {
      throw ApiException.validation("name: String must contain at least 2 character(s)");
    }
    if (s.length() > 120) {
      throw ApiException.validation("name: String must contain at most 120 character(s)");
    }
    return s;
  }

  private static String typeName(Object value) {
    if (value instanceof Number) return "number";
    if (value instanceof Boolean) return "boolean";
    if (value instanceof java.util.List<?>) return "array";
    if (value instanceof Map<?, ?>) return "object";
    return "null";
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
}