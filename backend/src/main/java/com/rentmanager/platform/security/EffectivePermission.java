package com.rentmanager.platform.security;

/**
 * A single effective permission: {@code module × action × scope}
 * (INTENT.md §5). Scope is one of GLOBAL / PROPERTY / OWN.
 */
public record EffectivePermission(String module, String action, String scope) {}
