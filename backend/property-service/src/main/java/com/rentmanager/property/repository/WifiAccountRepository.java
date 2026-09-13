package com.rentmanager.property.repository;

import com.rentmanager.property.domain.WifiAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WifiAccountRepository extends JpaRepository<WifiAccount, String> {
    List<WifiAccount> findByPropertyId(String propertyId);
}
