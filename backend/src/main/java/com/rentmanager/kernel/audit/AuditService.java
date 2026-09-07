package com.rentmanager.kernel.audit;

import com.rentmanager.kernel.tenant.TenantContext;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Persists audit entries with a per-tenant SHA-256 hash chain (mirrors the TS
 * {@code logAudit} in {@code src/lib/audit.ts}). Public API of the kernel module.
 */
@Service
public class AuditService {

  private final AuditLogRepository repo;

  public AuditService(AuditLogRepository repo) {
    this.repo = repo;
  }

  /** Runs in its own transaction so an audit write never rolls back business work. */
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public AuditLog log(AuditEntry entry) {
    String tenantId = TenantContext.get();
    AuditLog prev = repo.findFirstByTenantIdOrderByCreatedAtDesc(tenantId);
    String prevHash = prev != null ? prev.getHash() : null;
    String payload = String.join("|",
        nn(prevHash), nn(entry.actorId()), entry.module(), entry.action(),
        entry.entityType(), nn(entry.entityId()), entry.summary());
    String hash = sha256(payload);
    return repo.save(new AuditLog(entry, tenantId, prevHash, hash));
  }

  private static String nn(String s) { return s == null ? "" : s; }

  private static String sha256(String input) {
    try {
      MessageDigest md = MessageDigest.getInstance("SHA-256");
      byte[] d = md.digest(input.getBytes(StandardCharsets.UTF_8));
      StringBuilder sb = new StringBuilder(d.length * 2);
      for (byte b : d) sb.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
      return sb.toString();
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }
}
