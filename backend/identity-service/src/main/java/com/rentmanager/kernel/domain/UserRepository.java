package com.rentmanager.kernel.domain;

import java.time.Instant;
import java.util.Optional;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Read/write access to {@link User} for the auth + account paths. The email
 * lookup loads the role chain (mirroring {@code prisma.user.findUnique({include:
 * {roles: {include: {role: true}}}})} in the login route).
 */
public interface UserRepository extends JpaRepository<User, String> {

  @EntityGraph(attributePaths = {"roles", "roles.role"})
  Optional<User> findByEmail(String email);

  /**
   * Self-service profile name update (src/app/api/account/route.ts). {@code
   * null}: {@code User.updatedAt} is NOT NULL with no DB default, so it must be
   * set explicitly alongside the name.
   */
  @Modifying
  @Query("update User u set u.name = :name, u.updatedAt = :now where u.id = :id")
  int updateName(@Param("id") String id, @Param("name") String name, @Param("now") Instant now);
}