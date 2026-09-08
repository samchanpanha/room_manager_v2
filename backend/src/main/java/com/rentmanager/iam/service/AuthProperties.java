package com.rentmanager.iam.service;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Binds {@code rentmanager.auth.*}. */
@ConfigurationProperties(prefix = "rentmanager.auth")
public record AuthProperties(
    String sessionCookie,
    int sessionTtlDays,
    boolean cookieSecure,
    String challengeSecret) {

  public AuthProperties {
    if (sessionCookie == null || sessionCookie.isBlank()) sessionCookie = "rm_session";
    if (sessionTtlDays <= 0) sessionTtlDays = 30;
  }
}
