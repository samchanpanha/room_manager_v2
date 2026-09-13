package com.rentmanager.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

/**
 * RentManager API Gateway
 *
 * <p>Single entry-point for all BootUI → microservice traffic.
 *
 * <p>Responsibilities:
 * <ul>
 *   <li>Validate Keycloak-issued JWTs via JWKS (stateless; no DB call in gateway)</li>
 *   <li>Resolve downstream service instances via Nacos service discovery</li>
 *   <li>Inject {@code X-Rm-User-Id}, {@code X-Rm-Tenant-Id}, {@code X-Rm-Roles}
 *       headers so downstream services trust gateway-resolved identity</li>
 *   <li>Rate-limit per client (token-bucket, configurable via Nacos)</li>
 *   <li>Circuit-break with Resilience4j when a service is unreachable</li>
 *   <li>Forward legacy Next.js paths unchanged (strangler-fig: Next.js stays live)</li>
 * </ul>
 */
@SpringBootApplication
@EnableDiscoveryClient
public class GatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(GatewayApplication.class, args);
    }
}
