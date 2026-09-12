package com.rentmanager.kernel.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rentmanager.kernel.domain.AuditLog;
import com.rentmanager.kernel.domain.AuditLogRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Wire-compatible port of {@code logAudit} in src/lib/audit.ts: PII masking of
 * before/after payloads (emails, phone numbers, sensitive keys) and the M27
 * tamper-evident chain ({@code hash = SHA-256(prevHash | row fields)}). Each
 * append runs in its own transaction (read-last → write), so concurrent appends
 * cannot fork the chain — match the Next {@code prisma.$transaction}.
 */
@Component
public class AuditService {

  /** Emails, phones and sensitive keys flagged exactly like the Next masking regexes. */
  private static final Pattern EMAIL_RE = Pattern.compile(
      "([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+)([A-Za-z0-9-])([A-Za-z0-9-]*)\\.([A-Za-z]{2,})");
  private static final Pattern PHONE_RE = Pattern.compile("(\\+\\d{1,3}[\\s-]?)\\d[\\d\\s-]{6,}\\d");
  private static final java.util.Set<String> SENSITIVE_KEYS = java.util.Set.of(
      "email", "phone", "phone_number", "idNumber", "id_number", "nationalId",
      "password", "passwordHash", "token", "secret");

  private static final String DEFAULT_TENANT = "DEFAULT";
  /** JS {@code toISOString()}: always milliseconds, UTC — used in rowHash. */
  private static final DateTimeFormatter ISO_MILLIS =
      DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);

  private final AuditLogRepository auditLogs;
  private final ObjectMapper objectMapper;

  public AuditService(AuditLogRepository auditLogs, ObjectMapper objectMapper) {
    this.auditLogs = auditLogs;
    this.objectMapper = objectMapper;
  }

  public record AuditInput(
      String tenantId,
      String actorId,
      String actorName,
      String module,
      String action,
      String entityType,
      String entityId,
      String summary,
      Object before,
      Object after,
      String ip) {}

  @Transactional
  public void log(AuditInput input) {
    AuditLog last = auditLogs.findFirstByOrderByCreatedAtDescIdDesc().orElse(null);
    String prevHash = last == null ? null : last.getHash();
    String before = maskJson(input.before());
    String after = maskJson(input.after());
    Instant createdAt = Instant.now().truncatedTo(ChronoUnit.MILLIS);
    String hash = rowHash(prevHash, createdAt, input.actorId(), input.actorName(),
        input.module(), input.action(), input.entityType(), input.entityId(),
        input.summary(), before, after, input.ip());
    auditLogs.save(new AuditLog(
        UUID.randomUUID().toString().replace("-", ""),
        input.tenantId() == null || input.tenantId().isBlank() ? DEFAULT_TENANT : input.tenantId(),
        input.actorId(),
        input.actorName(),
        input.module(),
        input.action(),
        input.entityType(),
        input.entityId(),
        input.summary(),
        before,
        after,
        input.ip(),
        prevHash,
        hash,
        createdAt));
  }

  /** Same {@code rowHash} input/salt order and {@code |} joining as src/lib/audit.ts. */
  private static String rowHash(String prevHash, Instant createdAt, String actorId,
      String actorName, String module, String action, String entityType, String entityId,
      String summary, String before, String after, String ip) {
    String input = String.join("|",
        nvl(prevHash),
        ISO_MILLIS.format(createdAt),
        nvl(actorId),
        nvl(actorName),
        nvl(module),
        nvl(action),
        nvl(entityType),
        nvl(entityId),
        nvl(summary),
        nvl(before),
        nvl(after),
        nvl(ip));
    return sha256Hex(input);
  }

  private static String nvl(String s) {
    return s == null ? "" : s;
  }

  // ── PII masking (mirrors maskText / maskValue / maskJson) ────────────────

  private static String maskText(String text) {
    if (text == null) return null;
    text = EMAIL_RE.matcher(text).replaceAll(m -> {
      String first = m.group(1);
      String domain = m.group(2);
      String dFirst = m.group(3);
      String dRest = m.group(4);
      String tld = m.group(5);
      String stars = "*".repeat(Math.min(dRest.length(), 4));
      return first + "***@" + domain + dFirst + stars + "." + tld;
    });
    text = PHONE_RE.matcher(text).replaceAll(m -> m.group(1) + "\u2022\u2022\u2022\u2022\u2022");
    return text;
  }

  private String maskJson(Object value) {
    if (value == null) return null;
    return toJson(maskValue(fromJson(value), null));
  }

  static Object maskValue(Object value, String key) {
    if (value == null) return null;
    if (key != null && SENSITIVE_KEYS.contains(key)) {
      if (!(value instanceof String s)) return "***";
      return s.contains("@") ? maskText(s) : s.substring(0, 1) + "***";
    }
    if (value instanceof String s) return maskText(s);
    if (value instanceof List<?> list) {
      List<Object> out = new ArrayList<>(list.size());
      for (Object item : list) out.add(maskValue(item, null));
      return out;
    }
    if (value instanceof Map<?, ?> map) {
      Map<String, Object> out = new LinkedHashMap<>();
      for (Map.Entry<?, ?> e : map.entrySet()) {
        out.put(String.valueOf(e.getKey()), maskValue(e.getValue(), String.valueOf(e.getKey())));
      }
      return out;
    }
    return value;
  }

  /** Normalize to maps/lists/strings so masking behaves like JS {@code typeof}. */
  private Object fromJson(Object value) {
    if (value == null) return null;
    if (value instanceof String s) {
      // Numbers/booleans arrive as well-typed scalars from Jackson; a JSON object
      // string stays a string (the Next app passes object literal, not a string).
      return s;
    }
    if (value instanceof Number || value instanceof Boolean) return value;
    return objectMapper.convertValue(value, Object.class);
  }

  private String toJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (Exception e) {
      throw new IllegalStateException("Failed to serialize audit payload", e);
    }
  }

  private static String sha256Hex(String input) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      byte[] digest = md.digest(input.getBytes(StandardCharsets.UTF_8));
      StringBuilder sb = new StringBuilder(digest.length * 2);
      for (byte b : digest) {
        sb.append(Character.forDigit((b >> 4) & 0xF, 16));
        sb.append(Character.forDigit(b & 0xF, 16));
      }
      return sb.toString();
    } catch (NoSuchAlgorithmException e) {
      throw new IllegalStateException("SHA-256 unavailable", e);
    }
  }
}