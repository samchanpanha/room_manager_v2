package com.rentmanager;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.test.context.TestPropertySource;
import com.rentmanager.common.event.EventEnvelope;

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
    // ── In-memory DB (no Postgres needed for modulith test) ──────────────
    "spring.datasource.url=jdbc:h2:mem:modulith;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.jpa.properties.hibernate.globally_quoted_identifiers=true",
    // ── Disable infra auto-configs (Nacos / Kafka / Keycloak) ────────────
    "spring.cloud.nacos.discovery.enabled=false",
    "spring.cloud.nacos.config.enabled=false",
    "spring.autoconfigure.exclude=" +
        "org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration," +
        "org.springframework.security.oauth2.server.resource.autoconfigure.servlet.OAuth2ResourceServerAutoConfiguration",
    "spring.kafka.bootstrap-servers=",
    "rm.outbox.poll-interval-ms=99999999"  // disable outbox polling in unit tests
})
class ModularityTests {

  @MockBean
  private KafkaTemplate<String, EventEnvelope<?>> kafkaTemplate;

  @Test
  void verifiesModularStructure() {
    ApplicationModules.of(IdentityServiceApplication.class).verify();
  }
}