"use client";

import { useRouter } from "next/navigation";
import { Tx } from "@/components/i18n-text";

export function WorkspaceSelector({
  tenants,
  activeTenantId
}: {
  tenants: Array<{ id: string; name: string; slug: string }>;
  activeTenantId: string;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
        <Tx>Configuring Workspace:</Tx>
      </span>
      <select
        value={activeTenantId}
        onChange={(e) => {
          router.push(`/settings?tenantId=${encodeURIComponent(e.target.value)}`);
        }}
        className="h-9 rounded-md border bg-background px-3 py-1 text-sm font-medium shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {tenants.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.slug})
          </option>
        ))}
      </select>
    </div>
  );
}
