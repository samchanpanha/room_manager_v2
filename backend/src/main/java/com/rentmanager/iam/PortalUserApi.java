package com.rentmanager.iam;

import com.rentmanager.iam.domain.Role;
import com.rentmanager.iam.domain.RoleRepository;
import com.rentmanager.iam.domain.User;
import com.rentmanager.iam.domain.UserRepository;
import com.rentmanager.kernel.tenant.TenantContext;
import com.rentmanager.platform.security.PasswordHasher;
import com.rentmanager.platform.web.ApiException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Published API for provisioning portal logins tied to a party (e.g. the OWNER
 * portal login created during owner onboarding, M03; later the MEMBER portal).
 * Keeps user/role creation inside the IAM module so other modules never write to
 * IAM tables directly.
 */
@Service
public class PortalUserApi {

  private final UserRepository users;
  private final RoleRepository roles;
  private final PasswordHasher passwordHasher;

  @PersistenceContext
  private EntityManager em;

  public PortalUserApi(UserRepository users, RoleRepository roles, PasswordHasher passwordHasher) {
    this.users = users;
    this.roles = roles;
    this.passwordHasher = passwordHasher;
  }

  /**
   * Create a portal user with a single role (by key, e.g. {@code OWNER}) linked
   * to an existing party. Fails if the email is taken or the role is not seeded.
   */
  @Transactional
  public String createPortalUser(String email, String name, String password,
      String partyId, String roleKey) {
    String tenantId = TenantContext.get();
    users.findByEmailIgnoreCaseAndTenantId(email.toLowerCase(), tenantId).ifPresent(u -> {
      throw ApiException.duplicate("A user with this portal email already exists");
    });
    Role role = roles.findByKeyAndTenantId(roleKey, tenantId)
        .orElseThrow(() -> new ApiException(500, "MISSING_ROLE", roleKey + " role not seeded"));

    User user = new User(email.toLowerCase(), name, passwordHasher.hash(password), tenantId);
    setPartyId(user, partyId);
    users.saveAndFlush(user);

    // Insert the UserRole join row (composite key) via native-ish JPQL to avoid
    // exposing IAM join entities outside the module.
    em.createNativeQuery(
        "INSERT INTO \"UserRole\" (\"userId\", \"roleId\", \"assignedAt\") VALUES (?, ?, now())")
        .setParameter(1, user.getId())
        .setParameter(2, role.getId())
        .executeUpdate();
    return user.getId();
  }

  private void setPartyId(User user, String partyId) {
    // User.partyId has no public setter (immutable-ish); set via reflection-free
    // path: the field is package-private-friendly through a dedicated method.
    user.linkParty(partyId);
  }
}
