package com.rentmanager.kernel.settings;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Typed reader for the M28 settings groups the billing engine needs (INTENT.md
 * M06/M28) — a narrow port of {@code src/lib/settings.ts}. Reads the JSON blob
 * stored under each group key and layers it over hard-coded defaults, so a
 * missing or malformed row degrades to defaults instead of failing the job.
 * Public kernel API; write/UI live with M28 when it is ported.
 */
@Service
public class SettingsService {

  private static final String BILLING_KEY = "m28.billing";
  private static final String LATE_FEE_KEY = "m28.lateFee";
  private static final String ORG_KEY = "m28.org";
  private static final String PROVIDERS_KEY = "m28.providers";

  private final SettingRepository settings;
  private final SealedSecrets sealedSecrets;
  private final String paymentWebhookSecretEnv;
  private final ObjectMapper mapper = new ObjectMapper();

  public SettingsService(SettingRepository settings, SealedSecrets sealedSecrets,
      @Value("${rentmanager.payments.webhook-secret:dev-webhook-secret-change-me}")
      String paymentWebhookSecretEnv) {
    this.settings = settings;
    this.sealedSecrets = sealedSecrets;
    this.paymentWebhookSecretEnv = paymentWebhookSecretEnv;
  }

  /** Billing group: invoice prefix, grace period, dunning ladder. */
  public record BillingSettings(String invoicePrefix, int graceDays, List<Integer> dunningDays) {}

  /** Late-fee group: mode + amounts (mode "none" disables late fees). */
  public record LateFeeSettings(String mode, int flatMinor, int monthlyPctBps, int maxMinor) {}

  /** Org group (subset the backend needs): display name for receipts/QR. */
  public record OrgSettings(String name) {}

  /** Org display name, or the demo default when unset (matches settings.ts). */
  @Transactional(readOnly = true)
  public OrgSettings org() {
    JsonNode n = read(ORG_KEY);
    return new OrgSettings(text(n, "name", "RentManager Demo"));
  }

  /**
   * Plaintext provider secret used by the runtime — the DB-sealed value wins,
   * falling back to the env default (mirrors {@code getProviderSecret} in
   * settings.ts). Only {@code paymentCredentials} is needed on the backend.
   */
  @Transactional(readOnly = true)
  public String providerSecret(String name) {
    JsonNode n = read(PROVIDERS_KEY);
    if (n != null && n.hasNonNull(name)) {
      String plain = sealedSecrets.open(n.get(name).asText());
      if (plain != null && !plain.isEmpty()) return plain;
    }
    if ("paymentCredentials".equals(name)) return paymentWebhookSecretEnv;
    return null;
  }

  @Transactional(readOnly = true)
  public BillingSettings billing() {
    JsonNode n = read(BILLING_KEY);
    String prefix = text(n, "invoicePrefix", "");
    int grace = intVal(n, "graceDays", 3);
    List<Integer> dunning = new ArrayList<>();
    if (n != null && n.has("dunningDays") && n.get("dunningDays").isArray()) {
      n.get("dunningDays").forEach(d -> dunning.add(d.asInt()));
    }
    if (dunning.isEmpty()) { dunning.add(3); dunning.add(7); dunning.add(14); }
    return new BillingSettings(prefix, grace, dunning);
  }

  @Transactional(readOnly = true)
  public LateFeeSettings lateFee() {
    JsonNode n = read(LATE_FEE_KEY);
    return new LateFeeSettings(
        text(n, "mode", "none"),
        intVal(n, "flatMinor", 0),
        intVal(n, "monthlyPctBps", 0),
        intVal(n, "maxMinor", 0));
  }

  private JsonNode read(String key) {
    return settings.findByKey(key).map(s -> {
      try {
        return mapper.readTree(s.getValue());
      } catch (Exception e) {
        return (JsonNode) null;
      }
    }).orElse(null);
  }

  private static String text(JsonNode n, String field, String def) {
    return n != null && n.hasNonNull(field) ? n.get(field).asText() : def;
  }

  private static int intVal(JsonNode n, String field, int def) {
    return n != null && n.hasNonNull(field) ? n.get(field).asInt() : def;
  }
}
