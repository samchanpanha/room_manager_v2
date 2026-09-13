package com.rentmanager;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;
import org.springframework.modulith.Modulithic;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * RentManager Identity Service
 *
 * <p>Owns modules: M00 (Kernel), M01 (RBDC), M02 (Members), M03 (Owners),
 * M27 (Security), M28 (Settings).
 *
 * <p>Migrated from Slice 1 (strangler-fig) with additions:
 * <ul>
 *   <li>Nacos service discovery registration ({@code @EnableDiscoveryClient})</li>
 *   <li>Scheduled outbox relay ({@code @EnableScheduling} → {@link com.rentmanager.identity.kafka.OutboxRelay})</li>
 *   <li>Keycloak JWT acceptance in addition to the hand-rolled session cookie auth</li>
 * </ul>
 *
 * <p>{@code platform} and {@code kernel} are shared modules; {@code auth},
 * {@code members} are the verified application modules.
 */
@Modulithic(
    systemName = "IdentityService",
    sharedModules = {"platform", "kernel"}
)
@SpringBootApplication
@EnableDiscoveryClient
@EnableScheduling
public class IdentityServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(IdentityServiceApplication.class, args);
    }
}
