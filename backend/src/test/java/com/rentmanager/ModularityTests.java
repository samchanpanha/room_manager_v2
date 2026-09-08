package com.rentmanager;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;
import org.springframework.modulith.docs.Documenter;

/**
 * Verifies the Spring Modulith module boundaries: each module only depends on
 * its declared {@code allowedDependencies}, and there are no cycles. This is the
 * guardrail that keeps modules independently extractable into services later.
 */
class ModularityTests {

  private final ApplicationModules modules = ApplicationModules.of(RentManagerApplication.class);

  @Test
  void verifiesModuleStructure() {
    modules.verify();
  }

  @Test
  void writesDocumentation() {
    // Generates C4/PlantUML module docs under target/spring-modulith-docs.
    new Documenter(modules).writeDocumentation();
  }
}
