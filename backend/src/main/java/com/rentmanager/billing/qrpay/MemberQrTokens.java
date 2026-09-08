package com.rentmanager.billing.qrpay;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * M13 static/member QR tokens — stateless HMAC-signed references so a printed
 * poster or invoice QR lets a member pay without logging in (§M13
 * "pay-without-login via member QR scan"). Faithful port of
 * {@code src/lib/qrpay/tokens.ts}: HMAC-SHA256 over {@code "member:"+id} keyed by
 * {@code "qrpay:"+PAYMENT_WEBHOOK_SECRET}, token = {@code id.<mac base64url>}.
 */
@Component
public class MemberQrTokens {

  private final byte[] key;
  private final String appBaseUrl;

  public MemberQrTokens(
      @Value("${rentmanager.payments.webhook-secret:dev-webhook-secret-change-me}")
      String webhookSecret,
      @Value("${rentmanager.payments.app-base-url:http://localhost:3000}")
      String appBaseUrl) {
    this.key = ("qrpay:" + webhookSecret).getBytes(StandardCharsets.UTF_8);
    this.appBaseUrl = appBaseUrl;
  }

  public String signMemberToken(String memberProfileId) {
    return memberProfileId + "." + mac("member:" + memberProfileId);
  }

  /** @return the memberProfileId if the token is valid, else {@code null} (timing-safe). */
  public String verifyMemberToken(String token) {
    if (token == null) return null;
    int dot = token.lastIndexOf('.');
    if (dot <= 0) return null;
    String memberProfileId = token.substring(0, dot);
    byte[] provided = token.substring(dot + 1).getBytes(StandardCharsets.UTF_8);
    byte[] expected = mac("member:" + memberProfileId).getBytes(StandardCharsets.UTF_8);
    if (!MessageDigest.isEqual(provided, expected)) return null;
    return memberProfileId;
  }

  /** Absolute {@code {baseUrl}/pay?m=<token>} scan target for the member QR. */
  public String payUrl(String memberProfileId) {
    String base = appBaseUrl.endsWith("/") ? appBaseUrl.substring(0, appBaseUrl.length() - 1) : appBaseUrl;
    return base + "/pay?m=" + urlEncode(signMemberToken(memberProfileId));
  }

  private String mac(String message) {
    try {
      Mac hmac = Mac.getInstance("HmacSHA256");
      hmac.init(new SecretKeySpec(key, "HmacSHA256"));
      byte[] out = hmac.doFinal(message.getBytes(StandardCharsets.UTF_8));
      return Base64.getUrlEncoder().withoutPadding().encodeToString(out);
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private static String urlEncode(String v) {
    return java.net.URLEncoder.encode(v, StandardCharsets.UTF_8);
  }
}
