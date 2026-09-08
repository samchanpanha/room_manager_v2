package com.rentmanager.billing.qrpay;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * Resolves a {@link QrProvider} by name, falling back to DevMock (§M13 "DevMock
 * first"; real providers register here later). Java port of {@code
 * resolveProvider}/{@code isProviderName}/{@code PROVIDER_NAMES} in adapter.ts.
 * All registered {@link QrProvider} beans are auto-collected, so adding a real
 * provider is just registering a bean.
 */
@Component
public class QrProviderRegistry {

  private final Map<String, QrProvider> providers = new LinkedHashMap<>();
  private final QrProvider fallback;

  public QrProviderRegistry(List<QrProvider> beans, DevMockQrProvider devMock) {
    for (QrProvider p : beans) providers.put(p.name(), p);
    this.fallback = devMock;
  }

  /** DevMock first: unknown/absent names resolve to the mock provider. */
  public QrProvider resolve(String name) {
    if (name != null && providers.containsKey(name)) return providers.get(name);
    return fallback;
  }

  public boolean isProviderName(String name) {
    return name != null && providers.containsKey(name);
  }

  public List<String> providerNames() {
    return List.copyOf(providers.keySet());
  }
}
