package com.rentmanager.platform.config;

import com.rentmanager.platform.tenancy.TenantProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Enables typed configuration binding for platform-owned properties. */
@Configuration
@EnableConfigurationProperties({TenantProperties.class})
public class PlatformConfig {}
