package com.rentmanager.kernel.domain;

import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Read/write access to {@link Session}. The provider entity graph loads the full
 * identity chain (user → roles → permissions → permission + assignments) in a
 * single query, mirroring the Next {@code prisma.session.findUnique({include:
 * user: {include: {roles…, assignments}}})}.
 */
public interface SessionRepository extends JpaRepository<Session, String> {

  @EntityGraph(attributePaths = {
      "user",
      "user.roles",
      "user.roles.role",
      "user.roles.role.permissions",
      "user.roles.role.permissions.permission",
      "user.assignments"
  })
  Optional<Session> findByTokenHash(String tokenHash);

  /** Same effect as {@code prisma.session.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt } })}. */
  @Modifying
  @Query("update Session s set s.revokedAt = :revokedAt "
      + "where s.tokenHash = :tokenHash and s.revokedAt is null")
  int revokeByTokenHash(@Param("tokenHash") String tokenHash, @Param("revokedAt") Instant revokedAt);
}