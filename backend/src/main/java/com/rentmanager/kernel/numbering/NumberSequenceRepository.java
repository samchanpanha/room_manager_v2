package com.rentmanager.kernel.numbering;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface NumberSequenceRepository extends JpaRepository<NumberSequence, String> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select n from NumberSequence n where n.key = :key")
  Optional<NumberSequence> findForUpdate(@Param("key") String key);
}
