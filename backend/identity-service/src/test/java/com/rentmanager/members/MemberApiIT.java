package com.rentmanager.members;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.rentmanager.platform.security.TokenUtil;
import jakarta.servlet.http.Cookie;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Wire-parity integration tests for {@code GET /api/members} and
 * {@code GET /api/health} against a real Postgres (rentmanager_test) carrying
 * the Prisma-owned schema. Data is seeded with raw SQL through
 * {@link JdbcTemplate} so the exact production path is exercised: cookie
 * {@code rm_session} → {@code sha256(token)} → {@code Session.tokenHash} lookup
 * → RBDC gate → tenant-scoped list.
 *
 * <p>Run with {@code ./mvnw -Pintegration test} after refreshing the DB with
 * {@code npm run test:pg:reset}.
 */
@Tag("integration")
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:postgresql://localhost:5432/rentmanager_test",
    "spring.datasource.username=rentmanager",
    "spring.datasource.password=rentmanager"
})
class MemberApiIT {

  private static final String TENANT = "it-tenant";
  private static final String MEMBERS_TOKEN = "IT-members-token-0001";
  private static final String NOGATE_TOKEN = "IT-nogate-token-0001";

  private static final List<String> MEMBER_IDS =
      List.of("it-member-1", "it-member-2", "it-member-3");
  private static final List<String> USER_IDS =
      List.of("it-user-members", "it-user-nogate");
  private static final List<String> ROLE_IDS =
      List.of("it-role-members", "it-role-nogate");
  private static final List<String> PERMISSION_IDS =
      List.of("it:perm-members", "it:perm-nogate");
  private static final List<String> PARTY_IDS =
      List.of("it-party-1", "it-party-2", "it-party-3");
  private static final List<String> PROPERTY_IDS =
      List.of("it-property-1", "it-property-2");

  @Autowired private MockMvc mockMvc;
  @Autowired private JdbcTemplate jdbc;

  @BeforeEach
  void seed() {
    Instant now = Instant.now();

    jdbc.update("""
        INSERT INTO "Tenant" ("id","slug","name","status","createdAt","updatedAt")
        VALUES (?, ?, ?, 'active', ?, ?)
        """, TENANT, "it-tenant", "IT Tenant", ts(now), ts(now));
    // member-3 lives under a different tenant — must never appear in this
    // tenant's list. The foreign key needs the row to exist (previously the
    // tenant was left behind by older test versions and survived reset).
    jdbc.update("""
        INSERT INTO "Tenant" ("id","slug","name","status","createdAt","updatedAt")
        VALUES ('it-other-tenant', 'it-other-tenant', 'IT Other Tenant', 'active', ?, ?)
        """, ts(now), ts(now));

    jdbc.update("""
        INSERT INTO "Property" ("id","tenantId","code","name","status","createdAt")
        VALUES (?, ?, ?, ?, 'active', ?)
        """, "it-property-1", TENANT, "ITP-1", "IT Property One", ts(now));
    jdbc.update("""
        INSERT INTO "Property" ("id","tenantId","code","name","status","createdAt")
        VALUES (?, ?, ?, ?, 'active', ?)
        """, "it-property-2", TENANT, "ITP-2", "IT Property Two", ts(now));

    jdbc.update("""
        INSERT INTO "Building" ("id","propertyId","name","createdAt")
        VALUES (?, ?, ?, ?)
        """, "it-building-1", "it-property-1", "IT Building One", ts(now));
    jdbc.update("""
        INSERT INTO "Floor" ("id","buildingId","name","level")
        VALUES (?, ?, ?, ?)
        """, "it-floor-1", "it-building-1", "Ground", 0);
    jdbc.update("""
        INSERT INTO "Room" ("id","floorId","number","createdAt","updatedAt")
        VALUES (?, ?, ?, ?, ?)
        """, "it-room-1", "it-floor-1", "A-101", ts(now), ts(now));

    // member-1 (active, home property ITP-1) — the shape/cookie assertions target it.
    jdbc.update("""
        INSERT INTO "Party" ("id","tenantId","type","name","email","phone","createdAt")
        VALUES (?, ?, 'PERSON', ?, ?, ?, ?)
        """, "it-party-1", TENANT, "IT Alice", "alice@it.local", "111", ts(now));
    jdbc.update("""
        INSERT INTO "MemberProfile" ("id","partyId","status","blacklisted","homePropertyId",
                                     "nationality","idNumber","createdAt","updatedAt")
        VALUES (?, ?, 'active', false, ?, 'KH', ?, ?, ?)
        """, "it-member-1", "it-party-1", "it-property-1", "IT-101", ts(now), ts(now));

    // member-2 (notice, home property ITP-2) — filter coverage.
    jdbc.update("""
        INSERT INTO "Party" ("id","tenantId","type","name","email","phone","createdAt")
        VALUES (?, ?, 'PERSON', ?, ?, ?, ?)
        """, "it-party-2", TENANT, "IT Bob", "bob@it.local", "222", ts(now));
    jdbc.update("""
        INSERT INTO "MemberProfile" ("id","partyId","status","blacklisted","homePropertyId",
                                     "nationality","idNumber","createdAt","updatedAt")
        VALUES (?, ?, 'notice', false, ?, 'KH', 'IT-202', ?, ?)
        """, "it-member-2", "it-party-2", "it-property-2", ts(now), ts(now));

    // member-3 lives under a different tenant — must never appear in this tenant's list.
    jdbc.update("""
        INSERT INTO "Party" ("id","tenantId","type","name","email","phone","createdAt")
        VALUES (?, 'it-other-tenant', 'PERSON', ?, ?, ?, ?)
        """, "it-party-3", "Zed Other", "zed@it.local", "333", ts(now));
    jdbc.update("""
        INSERT INTO "MemberProfile" ("id","partyId","status","blacklisted","nationality",
                                     "idNumber","createdAt","updatedAt")
        VALUES (?, ?, 'active', false, 'KH', 'X-999', ?, ?)
        """, "it-member-3", "it-party-3", ts(now), ts(now));

    // Leases: member-1 has an active lease (edited createdAt) and a later draft — the
    // active one (earliest) is the one surfaced. member-2 has one active lease.
    jdbc.update("""
        INSERT INTO "Lease" ("id","code","memberProfileId","roomId","propertyId","status",
                             "startDate","rentAmountMinor","billingCycleDay","prorationBasis",
                             "depositTotalMinor","depositInstallments","noticeDays",
                             "createdAt","updatedAt")
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, 1, 'calendar', 0, 1, 30, ?, ?)
        """, "it-lease-1", "LSE-IT-1", "it-member-1", "it-room-1", "it-property-1",
        ts(Instant.parse("2024-01-01T00:00:00Z")), 500_000,
        ts(Instant.parse("2024-01-01T00:00:00Z")), ts(now));
    jdbc.update("""
        INSERT INTO "Lease" ("id","code","memberProfileId","roomId","propertyId","status",
                             "startDate","rentAmountMinor","billingCycleDay","prorationBasis",
                             "depositTotalMinor","depositInstallments","noticeDays",
                             "createdAt","updatedAt")
        VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, 1, 'calendar', 0, 1, 30, ?, ?)
        """, "it-lease-2", "LSE-IT-2", "it-member-1", "it-room-1", "it-property-1",
        ts(Instant.parse("2024-06-01T00:00:00Z")), 600_000,
        ts(Instant.parse("2024-06-01T00:00:00Z")), ts(now));
    jdbc.update("""
        INSERT INTO "Lease" ("id","code","memberProfileId","roomId","propertyId","status",
                             "startDate","rentAmountMinor","billingCycleDay","prorationBasis",
                             "depositTotalMinor","depositInstallments","noticeDays",
                             "createdAt","updatedAt")
        VALUES (?, ?, ?, ?, ?, 'active', ?, ?, 1, 'calendar', 0, 1, 30, ?, ?)
        """, "it-lease-3", "LSE-IT-3", "it-member-2", "it-room-1", "it-property-2",
        ts(Instant.parse("2024-03-01T00:00:00Z")), 400_000,
        ts(Instant.parse("2024-03-01T00:00:00Z")), ts(now));

    seedAuth();
  }

  /** Roles/delegates: members access user (M02:read GLOBAL) and a no-gate user (M10:read only). */
  private void seedAuth() {
    Instant now = Instant.now();

    jdbc.update("""
        INSERT INTO "Role" ("id","key","name","description","isSystem","isProtected","createdAt")
        VALUES (?, ?, ?, ?, false, false, ?)
        """, "it-role-members", "IT_MEMBERS_ACCESS", "IT members access", null, ts(now));
    jdbc.update("""
        INSERT INTO "Role" ("id","key","name","description","isSystem","isProtected","createdAt")
        VALUES (?, ?, ?, ?, false, false, ?)
        """, "it-role-nogate", "IT_NO_MEMBERS", "IT no members access", null, ts(now));

    // Scratch permission rows (the RBDC seed owns M02:read/M10:read; the gate
    // matches module:action:scope, so unique ids with the same semantics work).
    jdbc.update("""
        INSERT INTO "Permission" ("id","module","action") VALUES (?, 'M02', 'read')
        """, "it:perm-members");
    jdbc.update("""
        INSERT INTO "Permission" ("id","module","action") VALUES (?, 'M10', 'read')
        """, "it:perm-nogate");

    jdbc.update("""
        INSERT INTO "RolePermission" ("roleId","permissionId","scope")
        VALUES ('it-role-members', 'it:perm-members', 'GLOBAL')
        """);
    jdbc.update("""
        INSERT INTO "RolePermission" ("roleId","permissionId","scope")
        VALUES ('it-role-nogate', 'it:perm-nogate', 'GLOBAL')
        """);

    insertUser("it-user-members", "it-members@test.local", "Members IT", now);
    insertUser("it-user-nogate", "it-nogate@test.local", "NoGate IT", now);

    jdbc.update("""
        INSERT INTO "UserRole" ("userId","roleId","assignedAt") VALUES (?, ?, ?)
        """, "it-user-members", "it-role-members", ts(now));
    jdbc.update("""
        INSERT INTO "UserRole" ("userId","roleId","assignedAt") VALUES (?, ?, ?)
        """, "it-user-nogate", "it-role-nogate", ts(now));

    insertSession("it-session-members", "it-user-members", MEMBERS_TOKEN, now);
    insertSession("it-session-nogate", "it-user-nogate", NOGATE_TOKEN, now);
  }

  private void insertUser(String id, String email, String name, Instant now) {
    jdbc.update("""
        INSERT INTO "User"
          ("id","tenantId","email","name","passwordHash","status","totpEnabled",
           "mustChangePassword","createdAt","updatedAt")
        VALUES (?, ?, ?, ?, 'x', 'active', true, false, ?, ?)
        """, id, TENANT, email, name, ts(now), ts(now));
  }

  private void insertSession(String id, String userId, String rawToken, Instant now) {
    jdbc.update("""
        INSERT INTO "Session" ("id","userId","tokenHash","createdAt","expiresAt")
        VALUES (?, ?, ?, ?, ?)
        """, id, userId, TokenUtil.sha256Hex(rawToken),
        ts(now), ts(now.plus(1, ChronoUnit.DAYS)));
  }

  @AfterEach
  void cleanup() {
    String uid = idList(USER_IDS);
    jdbc.update("DELETE FROM \"Session\" WHERE \"userId\" IN " + uid);
    jdbc.update("DELETE FROM \"UserRole\" WHERE \"userId\" IN " + uid
        + " OR \"roleId\" IN " + idList(ROLE_IDS));
    jdbc.update("DELETE FROM \"RolePermission\" WHERE \"roleId\" IN " + idList(ROLE_IDS)
        + " OR \"permissionId\" IN " + idList(PERMISSION_IDS));
    jdbc.update("DELETE FROM \"Lease\" WHERE \"memberProfileId\" IN " + idList(MEMBER_IDS));
    jdbc.update("DELETE FROM \"User\" WHERE \"id\" IN " + uid);
    jdbc.update("DELETE FROM \"MemberProfile\" WHERE \"id\" IN " + idList(MEMBER_IDS));
    jdbc.update("DELETE FROM \"Role\" WHERE \"id\" IN " + idList(ROLE_IDS));
    jdbc.update("DELETE FROM \"Permission\" WHERE \"id\" IN " + idList(PERMISSION_IDS));
    // Deleting the properties cascades Building → Floor → Room.
    jdbc.update("DELETE FROM \"Property\" WHERE \"id\" IN " + idList(PROPERTY_IDS));
    jdbc.update("DELETE FROM \"Party\" WHERE \"id\" IN " + idList(PARTY_IDS));
    jdbc.update("DELETE FROM \"Tenant\" WHERE \"id\" = '" + TENANT
        + "' OR \"id\" = 'it-other-tenant'");
  }

  // ───────────────────────────── tests ─────────────────────────────

  @Test
  void unauthenticatedReturns401() throws Exception {
    mockMvc.perform(get("/api/members"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"))
        .andExpect(jsonPath("$.message").value("Sign in required"));
  }

  @Test
  void invalidCookieReturns401() throws Exception {
    mockMvc.perform(get("/api/members").cookie(new Cookie("rm_session", "not-a-real-token")))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void withoutAnyGatePermissionReturns403() throws Exception {
    mockMvc.perform(get("/api/members").cookie(sessionCookie(NOGATE_TOKEN)))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.error").value("FORBIDDEN"))
        .andExpect(jsonPath("$.message").value("Missing permission to list members"));
  }

  @Test
  void listReturnsWireShapeAndEarliestLease() throws Exception {
    mockMvc.perform(get("/api/members").cookie(sessionCookie(MEMBERS_TOKEN)))
        .andExpect(status().isOk())
        // Both members of this tenant only (member-3 is another tenant's).
        .andExpect(jsonPath("$.members.length()").value(2))
        .andExpect(jsonPath("$.members[0].id").value("it-member-1"))
        .andExpect(jsonPath("$.members[0].partyId").value("it-party-1"))
        .andExpect(jsonPath("$.members[0].status").value("active"))
        .andExpect(jsonPath("$.members[0].homePropertyId").value("it-property-1"))
        .andExpect(jsonPath("$.members[0].propertyCode").value("ITP-1"))
        .andExpect(jsonPath("$.members[0].party.id").value("it-party-1"))
        .andExpect(jsonPath("$.members[0].party.name").value("IT Alice"))
        .andExpect(jsonPath("$.members[0].party.email").value("alice@it.local"))
        .andExpect(jsonPath("$.members[0].party.phone").value("111"))
        // Earliest active/draft lease wins (the active one, not the later draft).
        .andExpect(jsonPath("$.members[0].leases.length()").value(1))
        .andExpect(jsonPath("$.members[0].leases[0].id").value("it-lease-1"))
        .andExpect(jsonPath("$.members[0].leases[0].code").value("LSE-IT-1"))
        .andExpect(jsonPath("$.members[0].leases[0].status").value("active"))
        .andExpect(jsonPath("$.members[0].leases[0].room.number").value("A-101"))
        .andExpect(jsonPath("$.members[1].party.name").value("IT Bob"))
        .andExpect(jsonPath("$.members[1].propertyCode").value("ITP-2"))
        .andExpect(jsonPath("$.members[1].leases[0].code").value("LSE-IT-3"));
  }

  @Test
  void qMatchesNameIdNumberAndEmpty() throws Exception {
    assertFilter("q", "IT Alice", 1, "it-member-1");
    assertFilter("q", "it-101", 1, "it-member-1"); // idNumber, case-insensitive
    assertFilter("q", "zed-other", 0, null);       // other tenant is out of scope
    assertFilter("q", "nonexistent-name", 0, null);
  }

  @Test
  void statusFilter() throws Exception {
    assertFilter("status", "notice", 1, "it-member-2");
    assertFilter("status", "moved_out", 0, null);
  }

  @Test
  void propertyIdFilter() throws Exception {
    assertFilter("propertyId", "it-property-1", 1, "it-member-1");
    assertFilter("propertyId", "it-property-2", 1, "it-member-2");
  }

  @Test
  void healthReturnsOk() throws Exception {
    mockMvc.perform(get("/api/health"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("ok"))
        .andExpect(jsonPath("$.time").isNotEmpty());
  }

  // ───────────────────────────── helpers ─────────────────────────────

  private void assertFilter(String param, String value, int expectedCount, String expectedFirstId)
      throws Exception {
    var ops = mockMvc.perform(get("/api/members")
            .param(param, value)
            .cookie(sessionCookie(MEMBERS_TOKEN)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.members.length()").value(expectedCount));
    if (expectedFirstId != null) {
      ops.andExpect(jsonPath("$.members[0].id").value(expectedFirstId));
    }
  }

  private static Cookie sessionCookie(String rawToken) {
    return new Cookie("rm_session", rawToken);
  }

  private static String idList(List<String> ids) {
    return "(" + String.join(", ", ids.stream().map(id -> "'" + id + "'").toList()) + ")";
  }

  private static Timestamp ts(Instant instant) {
    return Timestamp.from(instant);
  }
}