package com.rentmanager;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.modulith.Modulithic;

/**
 * RentManager backend — a Spring Modulith modular monolith.
 *
 * <p>Strangler-fig slice 1: the {@code members} module (M02 reads) behind the
 * existing {@code BACKEND_ORIGIN} seam, wire-compatible with the Next.js
 * handlers it replaces. {@code platform} (security/web plumbing) and
 * {@code kernel} (domain entities bound to the Prisma-owned schema) are shared
 * modules; {@code members} is the only verified application module.
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