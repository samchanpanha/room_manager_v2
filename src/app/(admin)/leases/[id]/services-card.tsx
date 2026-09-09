"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { Tx } from "@/components/i18n-text";

interface ServiceView {
  id: string;
  name: string;
  amountMinor: number;
  pricingModel: string;
}

interface CatalogItem {
  id: string;
  code: string;
  name: string;
  pricingModel: string;
  unitPriceMinor: number;
  unitLabel?: string | null;
}

interface ParkingSlotRef {
  id: string;
  code: string;
  monthlyFeeMinor: number;
}

interface WifiAccountRef {
  id: string;
  ssid: string;
  speedLabel?: string | null;
}

export function ServicesCard({
  leaseId,
  status,
  services,
  canUpdate,
  catalog = [],
  parkingSlots = [],
  wifiAccounts = []
}: {
  leaseId: string;
  status: string;
  services: ServiceView[];
  canUpdate: boolean;
  catalog?: CatalogItem[];
  parkingSlots?: ParkingSlotRef[];
  wifiAccounts?: WifiAccountRef[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [model, setModel] = useState("fixed_monthly");
  const [slotCode, setSlotCode] = useState("");
  const [wifiSsid, setWifiSsid] = useState("");

  const ended = status === "terminated" || status === "completed";
  const money = (m: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(m / 100);

  function pickCatalog(id: string) {
    setSelectedCatalogId(id);
    if (!id) {
      setName("");
      setAmount("");
      setModel("fixed_monthly");
      setSlotCode("");
      setWifiSsid("");
      return;
    }
    const c = catalog.find((x) => x.id === id);
    if (c) {
      setName(c.name);
      setAmount((c.unitPriceMinor / 100).toFixed(2));
      setModel(c.pricingModel);
      const isParking = c.code === "PARK" || c.name.toLowerCase().includes("parking");
      const isWifi = c.code === "WIFI" || c.name.toLowerCase().includes("wifi");
      if (isParking && parkingSlots.length > 0) setSlotCode(parkingSlots[0]!.code);
      if (isWifi && wifiAccounts.length > 0) setWifiSsid(wifiAccounts[0]!.ssid);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);

    try {
      if (status === "active" && selectedCatalogId) {
        // Active lease assigning a catalog service -> use assignment endpoint to bind resources properly
        const res = await fetch("/api/services/assignments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leaseId,
            serviceId: selectedCatalogId,
            parkingSlotCode: slotCode || undefined,
            wifiSsid: wifiSsid || undefined
          })
        });
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        if (!res.ok) {
          push({ title: "Could not assign service", description: body.message, variant: "destructive" });
          return;
        }
      } else {
        // Draft lease or custom service -> lease service endpoint
        let finalName = name;
        if (slotCode && !finalName.includes(slotCode)) finalName = `${finalName} (${slotCode})`;
        const res = await fetch(`/api/leases/${leaseId}/services`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: finalName, amount: Number(amount), pricingModel: model })
        });
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        if (!res.ok) {
          push({ title: "Could not add service", description: body.message, variant: "destructive" });
          return;
        }
      }

      push({ title: "Service added & included in monthly invoices", variant: "success" });
      setSelectedCatalogId("");
      setName("");
      setAmount("");
      setSlotCode("");
      setWifiSsid("");
      setAdding(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, svcName: string) {
    if (!window.confirm(`Remove "${svcName}" from this draft lease?`)) return;
    setBusy(true);
    const res = await fetch(`/api/lease-services/${id}`, { method: "DELETE" });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Remove failed", description: body.message, variant: "destructive" });
      return;
    }
    push({ title: "Service removed", variant: "success" });
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium"><Tx>Included services</Tx></p>
            <p className="text-xs text-muted-foreground"><Tx>Billed every month on recurring invoice</Tx></p>
          </div>
          {canUpdate && !ended ? (
            <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
              {adding ? "Cancel" : "+ Add service"}
            </Button>
          ) : null}
        </div>

        {adding ? (
          <form onSubmit={add} className="mb-4 space-y-2.5 rounded-lg border bg-muted/20 p-3">
            {catalog.length > 0 ? (
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground"><Tx>Pick from catalog (optional):</Tx></label>
                <Select value={selectedCatalogId} onChange={(e) => pickCatalog(e.target.value)}>
                  <option value="">— Custom service / type manually —</option>
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — ${(c.unitPriceMinor / 100).toFixed(2)}{c.pricingModel === "fixed_monthly" ? "/mo" : c.unitLabel ? `/${c.unitLabel}` : ""}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-[1fr_110px_130px]">
              <Input
                placeholder="Service name (e.g. WiFi)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
              <Input
                placeholder="Amount / mo"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
              <Select value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="fixed_monthly"><Tx>fixed monthly</Tx></option>
                <option value="per_use"><Tx>per use</Tx></option>
                <option value="metered"><Tx>metered</Tx></option>
              </Select>
            </div>

            {name.toLowerCase().includes("parking") && parkingSlots.length > 0 ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Parking slot:</span>
                <Select value={slotCode} onChange={(e) => setSlotCode(e.target.value)} className="h-7 text-xs">
                  <option value="">(no specific slot)</option>
                  {parkingSlots.map((s) => (
                    <option key={s.id} value={s.code}>
                      {s.code} (${(s.monthlyFeeMinor / 100).toFixed(2)}/mo)
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            {name.toLowerCase().includes("wifi") && wifiAccounts.length > 0 ? (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">WiFi account:</span>
                <Select value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} className="h-7 text-xs">
                  <option value="">(no specific SSID)</option>
                  {wifiAccounts.map((w) => (
                    <option key={w.id} value={w.ssid}>
                      {w.ssid} {w.speedLabel ? `(${w.speedLabel})` : ""}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" variant="success" disabled={busy}>
                {busy ? "Adding…" : "Add & schedule for monthly invoices"}
              </Button>
            </div>
          </form>
        ) : null}

        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground"><Tx>No optional services assigned yet.</Tx></p>
        ) : (
          <ul className="divide-y text-sm">
            {services.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <div>
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">({s.pricingModel.replaceAll("_", " ")})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums font-semibold">{money(s.amountMinor)}<Tx>/mo</Tx></span>
                  {canUpdate && status === "draft" ? (
                    <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => remove(s.id, s.name)}>
                      ✕
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {status === "draft" && canUpdate ? (
          <p className="mt-2 text-xs text-muted-foreground"><Tx>Services assigned here are included in every monthly invoice upon activation.</Tx></p>
        ) : null}
      </CardContent>
    </Card>
  );
}
