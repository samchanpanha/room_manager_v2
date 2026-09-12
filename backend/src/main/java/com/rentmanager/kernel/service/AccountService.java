package com.rentmanager.kernel.service;

import com.rentmanager.kernel.domain.UserRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Self-service profile operations (src/app/api/account/route.ts). The name is
 * stored trimmed and {@code updatedAt} is bumped manually because the Prisma
 * model has no DB default for it.
 */
@Component
public class AccountService {

  private final UserRepository users;

  public AccountService(UserRepository users) {
    this.users = users;
  }

  @Transactional
  public boolean updateName(String userId, String trimmedName) {
    int rows = users.updateName(userId, trimmedName, Instant.now().truncatedTo(ChronoUnit.MILLIS));
    return rows > 0;
  }
}