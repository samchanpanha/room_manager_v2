package com.rentmanager.billing.qrpay.web;

import com.rentmanager.billing.qrpay.MemberQrTokens;
import com.rentmanager.billing.qrpay.QrCodeRenderer;
import com.rentmanager.members.MemberAccessApi;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.platform.security.Rbdc;
import com.rentmanager.platform.web.ApiException;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * M13 member pay QR (§M13 static/member QR) — mirrors {@code GET
 * /api/members/{id}/qr}. Encodes {@code {APP_BASE_URL}/pay?m=<signed token>}.
 * Members fetch their own; staff with {@code M02:read} in scope fetch it for
 * printing posters/invoice inserts.
 */
@RestController
@RequestMapping("/api/members")
public class MemberQrController {

  private final MemberAccessApi membersApi;
  private final MemberQrTokens tokens;
  private final QrCodeRenderer renderer;
  private final CurrentUser currentUser;

  public MemberQrController(MemberAccessApi membersApi, MemberQrTokens tokens,
      QrCodeRenderer renderer, CurrentUser currentUser) {
    this.membersApi = membersApi;
    this.tokens = tokens;
    this.renderer = renderer;
    this.currentUser = currentUser;
  }

  @GetMapping("/{id}/qr")
  public Map<String, Object> memberQr(@PathVariable String id) {
    AuthPrincipal user = currentUser.require();
    // Throws 404 when the member does not exist (mirrors the Next handler).
    MemberAccessApi.MemberInfo member = membersApi.get(id);

    String own = membersApi.memberIdForParty(user.partyId());
    boolean isOwn = own != null && own.equals(id);
    if (!isOwn
        && !Rbdc.can(user, "read", "M02", Rbdc.ResourceRef.property(member.homePropertyId()))) {
      throw new ApiException(403, "FORBIDDEN", "Missing permission M02:read for this member");
    }

    String token = tokens.signMemberToken(id);
    String payUrl = tokens.payUrl(id);
    String imageDataUrl = renderer.toPngDataUrl(payUrl);
    Map<String, Object> out = new LinkedHashMap<>();
    out.put("token", token);
    out.put("imageDataUrl", imageDataUrl);
    out.put("payUrl", payUrl);
    return out;
  }
}
