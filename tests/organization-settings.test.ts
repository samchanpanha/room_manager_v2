import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { registerTenant } from "@/lib/tenant";
import {
  getSettings,
  updateSettings,
  getFeatureFlags,
  isModuleEnabled,
  setProviderSecret,
  getProviderSecret,
  getTemplateOverride
} from "@/lib/settings";

describe("Organization Workspace-Scoped Settings (M28)", () => {
  it("isolates configuration settings across different organization workspaces", async () => {
    const timestamp = Date.now();
    // 1. Register Workspace A
    const orgA = await registerTenant({
      companyName: "Alpha Residences",
      slug: `alpha-${timestamp}`,
      adminName: "Admin Alpha",
      adminEmail: `alpha-${timestamp}@test.org`,
      password: "Password123!",
      initialPropertyName: "Alpha Tower"
    });

    // 2. Register Workspace B
    const orgB = await registerTenant({
      companyName: "Beta Estates",
      slug: `beta-${timestamp}`,
      adminName: "Admin Beta",
      adminEmail: `beta-${timestamp}@test.org`,
      password: "Password123!",
      initialPropertyName: "Beta Garden"
    });

    const actorA = { id: orgA.user.id, name: orgA.user.name };
    const actorB = { id: orgB.user.id, name: orgB.user.name };

    // 3. Read initial settings for both workspaces
    const settingsAInitial = await getSettings(orgA.tenant.id);
    const settingsBInitial = await getSettings(orgB.tenant.id);

    expect(settingsAInitial.org.name).toBe("Alpha Residences");
    expect(settingsAInitial.org.email).toBe(`alpha-${timestamp}@test.org`);

    expect(settingsBInitial.org.name).toBe("Beta Estates");
    expect(settingsBInitial.org.email).toBe(`beta-${timestamp}@test.org`);

    // 4. Update Workspace A settings (org, locale, billing, lateFee)
    await updateSettings(
      "org",
      {
        name: "Alpha Residences Luxury",
        legalName: "Alpha Living Corp Ltd",
        address: "Building A, Skyline Ave",
        taxId: "KH-ALPHA-999",
        invoiceTemplate: "modern"
      },
      actorA,
      "127.0.0.1",
      orgA.tenant.id
    );

    await updateSettings(
      "locale",
      { currency: "EUR", timezone: "Europe/Paris", locale: "en" },
      actorA,
      null,
      orgA.tenant.id
    );

    await updateSettings(
      "billing",
      { invoicePrefix: "ALPHA-INV-", graceDays: 7, dunningDays: [5, 10, 20] },
      actorA,
      null,
      orgA.tenant.id
    );

    await updateSettings(
      "features",
      { M14: false, M15: true },
      actorA,
      null,
      orgA.tenant.id
    );

    // 5. Update Workspace B with distinct settings
    await updateSettings(
      "locale",
      { currency: "KHR", timezone: "Asia/Phnom_Penh", locale: "km" },
      actorB,
      null,
      orgB.tenant.id
    );

    await updateSettings(
      "billing",
      { invoicePrefix: "BETA-", graceDays: 1, dunningDays: [2, 4] },
      actorB,
      null,
      orgB.tenant.id
    );

    // 6. Verify Workspace A has its custom settings
    const settingsA = await getSettings(orgA.tenant.id);
    expect(settingsA.org.name).toBe("Alpha Residences Luxury");
    expect(settingsA.org.legalName).toBe("Alpha Living Corp Ltd");
    expect(settingsA.org.taxId).toBe("KH-ALPHA-999");
    expect(settingsA.org.invoiceTemplate).toBe("modern");
    expect(settingsA.locale.currency).toBe("EUR");
    expect(settingsA.billing.invoicePrefix).toBe("ALPHA-INV-");
    expect(settingsA.billing.graceDays).toBe(7);
    expect(settingsA.billing.dunningDays).toEqual([5, 10, 20]);
    expect(settingsA.features.M14).toBe(false);

    // Also verify feature flag helper functions respect workspace scoping
    expect(await isModuleEnabled("M14", orgA.tenant.id)).toBe(false);
    expect(await isModuleEnabled("M15", orgA.tenant.id)).toBe(true);
    const flagsA = await getFeatureFlags(orgA.tenant.id);
    expect(flagsA.M14).toBe(false);

    // 7. Verify Workspace B remained completely isolated
    const settingsB = await getSettings(orgB.tenant.id);
    expect(settingsB.org.name).toBe("Beta Estates");
    expect(settingsB.locale.currency).toBe("KHR");
    expect(settingsB.billing.invoicePrefix).toBe("BETA-");
    expect(settingsB.billing.graceDays).toBe(1);
    expect(settingsB.billing.dunningDays).toEqual([2, 4]);
    expect(settingsB.features.M14).toBe(true); // default true, untouched by org A
    expect(await isModuleEnabled("M14", orgB.tenant.id)).toBe(true);

    // 8. Verify DEFAULT workspace is unaffected
    const defaultSettings = await getSettings("DEFAULT");
    expect(defaultSettings.billing.invoicePrefix).toBe("");
    expect(defaultSettings.billing.graceDays).toBe(3);

    // 9. Verify Tenant table synchronization when org name is updated
    const updatedTenantA = await prisma.tenant.findUnique({ where: { id: orgA.tenant.id } });
    expect(updatedTenantA?.name).toBe("Alpha Residences Luxury");

    // 10. Verify audit logs contain the tenantId
    const auditLogs = await prisma.auditLog.findMany({
      where: { module: "M28", tenantId: orgA.tenant.id },
      orderBy: { createdAt: "desc" }
    });
    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs[0].tenantId).toBe(orgA.tenant.id);
  });

  it("seals provider secrets independently per organization workspace", async () => {
    const timestamp = Date.now();

    const org1 = await registerTenant({
      companyName: "Secret Tower 1",
      slug: `sec1-${timestamp}`,
      adminName: "Admin 1",
      adminEmail: `sec1-${timestamp}@test.org`,
      password: "Password123!"
    });

    const org2 = await registerTenant({
      companyName: "Secret Tower 2",
      slug: `sec2-${timestamp}`,
      adminName: "Admin 2",
      adminEmail: `sec2-${timestamp}@test.org`,
      password: "Password123!"
    });

    const actor1 = { id: org1.user.id, name: org1.user.name };
    const actor2 = { id: org2.user.id, name: org2.user.name };

    const secret1 = "bot-token-org-1-abcdef123456";
    const secret2 = "bot-token-org-2-uvwxyz789012";

    await setProviderSecret("telegramBotToken", secret1, actor1, null, org1.tenant.id);
    await setProviderSecret("telegramBotToken", secret2, actor2, null, org2.tenant.id);

    // Accessors return decrypted plaintext per tenant
    expect(await getProviderSecret("telegramBotToken", org1.tenant.id)).toBe(secret1);
    expect(await getProviderSecret("telegramBotToken", org2.tenant.id)).toBe(secret2);

    // Masked on read
    const s1 = await getSettings(org1.tenant.id);
    const s2 = await getSettings(org2.tenant.id);
    expect(s1.providers.telegramBotToken.configured).toBe(true);
    expect(s1.providers.telegramBotToken.last4).toBe("3456");
    expect(s2.providers.telegramBotToken.configured).toBe(true);
    expect(s2.providers.telegramBotToken.last4).toBe("9012");
  });

  it("supports notification template overrides per organization workspace", async () => {
    const timestamp = Date.now();

    const org = await registerTenant({
      companyName: "Template Heights",
      slug: `tpl-${timestamp}`,
      adminName: "Admin Tpl",
      adminEmail: `tpl-${timestamp}@test.org`,
      password: "Password123!"
    });

    const actor = { id: org.user.id, name: org.user.name };

    // Custom template for org
    await updateSettings(
      "templates",
      { "invoice.issued": "Custom Org Notice: {code} for {total}" },
      actor,
      null,
      org.tenant.id
    );

    const renderedOrg = await getTemplateOverride("invoice.issued", { code: "INV-001", total: "$100" }, org.tenant.id);
    expect(renderedOrg).toBe("Custom Org Notice: INV-001 for $100");

    // Other events not overridden fall back
    const otherOrg = await getTemplateOverride("payment.confirmed", { code: "INV-001", total: "$100" }, org.tenant.id);
    expect(otherOrg).toBeNull();
  });
});
