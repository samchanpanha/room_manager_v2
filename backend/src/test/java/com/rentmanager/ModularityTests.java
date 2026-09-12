package com.rentmanager;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.test.context.TestPropertySource;

/**
 * Spring Modulith module-boundary verification. {@code platform} and
 * {@code kernel} are declared shared modules (and {@code OPEN} so their
 * sub-package types are visible); {@code members} and {@code auth} are the
 * application modules, each authorized to depend on both. Boots the full
 * application on in-memory H2 (schema built from the entity mappings, a
 * read-only slice of the Prisma-owned schema) so the default {@code ./mvnw
 * test} needs no running Postgres. Quoted identifiers are forced so the
 * PascalCase table names are not mangled on H2. The structure itself is
 * verified eagerly via {@link ApplicationModules#verify()} inside a plain
 * {@link SpringBootTest} (not {@code @ApplicationModuleTest}, whose module
 * slicing re-registers the JPA repositories).
 */
@SpringBootTest
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:modulith;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.jpa.properties.hibernate.globally_quoted_identifiers=true"
})
class ModularityTests {

  @Test
  void verifiesModularStructure() {
    ApplicationModules.of(RentManagerApplication.class).verify();
  }
}