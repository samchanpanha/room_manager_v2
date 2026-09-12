package com.rentmanager.members.web;

import com.rentmanager.members.dto.MemberListResponse;
import com.rentmanager.members.service.MemberQueryService;
import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.CurrentUser;
import com.rentmanager.platform.security.Rbdc;
import com.rentmanager.platform.web.ApiException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST for M02 reads, mirroring {@code src/app/api/members/route.ts} GET.
 *
 * <p>The 6-way OR gate and the {@code {error, message}} error shape are
 * byte-for-byte parity with the Next handler.
 */
@RestController
@RequestMapping("/api/members")
public class MemberController {

  private static final String LIST_GATE_MESSAGE = "Missing permission to list members";

  private final MemberQueryService service;
  private final CurrentUser currentUser;

  public MemberController(MemberQueryService service, CurrentUser currentUser) {
    this.service = service;
    this.currentUser = currentUser;
  }

  @GetMapping
  public MemberListResponse list(
      @RequestParam(required = false) String status,
      @RequestParam(required = false) String propertyId,
      @RequestParam(required = false) String q) {

    // 1. Must be authenticated (same shape as getAuthUser → null → 401).
    AuthPrincipal user = currentUser.require();

    // 2. The same 6-way OR gate as the Next handler.
    boolean gate =
           Rbdc.hasModuleAccess(user, "read", "M02")
        || Rbdc.hasModuleAccess(user, "read", "M09")
        || Rbdc.hasModuleAccess(user, "create", "M09")
        || Rbdc.hasModuleAccess(user, "read", "M05")
        || Rbdc.hasModuleAccess(user, "create", "M05")
        || Rbdc.hasModuleAccess(user, "read", "M07");

    if (!gate) {
      throw new ApiException(403, "FORBIDDEN", LIST_GATE_MESSAGE);
    }

    return new MemberListResponse(service.list(user.tenantId(), status, propertyId, q));
  }
}