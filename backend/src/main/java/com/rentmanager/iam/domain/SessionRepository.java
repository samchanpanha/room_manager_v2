package com.rentmanager.iam.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SessionRepository extends JpaRepository<Session, String> {
  Optional<Session> findByTokenHash(String tokenHash);
  List<Session> findByUserId(String userId);
}
