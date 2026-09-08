package com.rentmanager;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.modulith.Modulithic;

/**
 * RentManager backend — a Spring Modulith modular monolith.
 *
 * <p>Each business capability (M01…M33 from INTENT.md) is a Spring Modulith
 * module under {@code com.rentmanager.*}. Modules interact only through their
 * published service interfaces (the {@code service}/{@code api} package) or via
 * application events, so any module can later be extracted into its own
 * deployable service without a domain rewrite.
 */
@Modulithic(
    systemName = "RentManager",
    sharedModules = {"platform", "kernel"}
)
@SpringBootApplication
public class RentManagerApplication {
  public static void main(String[] args) {
    SpringApplication.run(RentManagerApplication.class, args);
  }
}
