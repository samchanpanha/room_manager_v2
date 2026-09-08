package com.rentmanager.iam.service;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Enables IAM-owned typed configuration ({@code rentmanager.auth.*}). */
@Configuration
@EnableConfigurationProperties({AuthProperties.class})
public class IamConfig {}
