package com.rentmanager;

import static org.assertj.core.api.Assertions.assertThat;

import com.rentmanager.platform.security.AuthPrincipal;
import com.rentmanager.platform.security.EffectivePermission;
import com.rentmanager.platform.security.Rbdc;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Ports the negative/positive RBDC tests from the TS matrix test so the two
 * stacks enforce identical access decisions (INTENT.md §5 acceptance).
 */
class RbdcTest {

  private AuthPrincipal user(List<EffectivePermission> perms, List<String> propertyIds, boolean totpPending) {
    return new AuthPrincipal("u1", "U", "u@x.io", null, "s1", "DEFAULT",
        List.of("PROPERTY_MANAGER"), propertyIds, perms, false, totpPending, false);
  }

  @Test
  void globalGrantAllowsAnyResource() {
    var u = user(List.of(new EffectivePermission("M02", "read", "GLOBAL")), List.of(), false);
    assertThat(Rbdc.can(u, "read", "M02")).isTrue();
    assertThat(Rbdc.can(u, "read", "M02", Rbdc.ResourceRef.property("pAny"))).isTrue();
  }

  @Test
  void propertyScopeOnlyAllowsAssignedProperties() {
    var u = user(List.of(new EffectivePermission("M02", "read", "PROPERTY")), List.of("pA"), false);
    assertThat(Rbdc.can(u, "read", "M02", Rbdc.ResourceRef.property("pA"))).isTrue();
    assertThat(Rbdc.can(u, "read", "M02", Rbdc.ResourceRef.property("pB"))).isFalse();
  }

  @Test
  void ownScopeMatchesOnlyOwner() {
    var u = user(List.of(new EffectivePermission("M17", "read", "OWN")), List.of(), false);
    assertThat(Rbdc.can(u, "read", "M17", Rbdc.ResourceRef.own("u1"))).isTrue();
    assertThat(Rbdc.can(u, "read", "M17", Rbdc.ResourceRef.own("u2"))).isFalse();
  }

  @Test
  void cashierCannotEditInvoices() {
    // "Cashier" = only payments write; must NOT get invoice update (INTENT.md M01 acceptance).
    var u = user(List.of(new EffectivePermission("M09", "update", "GLOBAL")), List.of(), false);
    assertThat(Rbdc.can(u, "update", "M07")).isFalse();
  }

  @Test
  void totpPendingAdminBlockedEverywhereButM27() {
    var u = user(List.of(new EffectivePermission("M02", "read", "GLOBAL")), List.of(), true);
    assertThat(Rbdc.can(u, "read", "M02")).isFalse();
    assertThat(Rbdc.hasModuleAccess(u, "read", "M02")).isFalse();
  }
}
