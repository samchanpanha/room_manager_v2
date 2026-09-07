package com.rentmanager.kernel.audit;

/**
 * Value describing a single auditable action. Built via {@link #builder()} and
 * persisted by {@link AuditService#log(AuditEntry)}.
 */
public record AuditEntry(
    String actorId,
    String actorName,
    String module,
    String action,
    String entityType,
    String entityId,
    String summary,
    String before,
    String after,
    String ip) {

  public static Builder builder() {
    return new Builder();
  }

  public static final class Builder {
    private String actorId;
    private String actorName = "system";
    private String module;
    private String action;
    private String entityType;
    private String entityId;
    private String summary;
    private String before;
    private String after;
    private String ip;

    public Builder actorId(String v) { this.actorId = v; return this; }
    public Builder actorName(String v) { this.actorName = v; return this; }
    public Builder module(String v) { this.module = v; return this; }
    public Builder action(String v) { this.action = v; return this; }
    public Builder entityType(String v) { this.entityType = v; return this; }
    public Builder entityId(String v) { this.entityId = v; return this; }
    public Builder summary(String v) { this.summary = v; return this; }
    public Builder before(String v) { this.before = v; return this; }
    public Builder after(String v) { this.after = v; return this; }
    public Builder ip(String v) { this.ip = v; return this; }

    public AuditEntry build() {
      return new AuditEntry(actorId, actorName, module, action, entityType,
          entityId, summary, before, after, ip);
    }
  }
}
