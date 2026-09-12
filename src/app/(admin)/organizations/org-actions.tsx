"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { Tx } from "@/components/i18n-text";

export interface TenantData {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  status: string;
}

export function EditOrgModal({
  tenant,
  canEdit
}: {
  tenant: TenantData;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(tenant.name);
  const [contactEmail, setContactEmail] = useState(tenant.contactEmail ?? "");
  const [status, setStatus] = useState(tenant.status);

  if (!canEdit) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`/api/organizations/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          contactEmail: contactEmail.trim() || null,
          status
        })
      });
      const data = await res.json();
      if (!res.ok) {
        push({ title: "Failed to update", description: data.message || "An error occurred", variant: "destructive" });
      } else {
        push({ title: "Organization updated", description: "Changes saved successfully", variant: "success" });
        setOpen(false);
        router.refresh();
      }
    } catch {
      push({ title: "Error", description: "Network connection error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Tx>Edit Details</Tx>
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl ring-1 ring-border">
            <h3 className="text-lg font-semibold"><Tx>Edit Organization</Tx></h3>
            <p className="mt-1 text-xs text-muted-foreground">
              <Tx>Update organization display name, contact email, and operational status.</Tx>
            </p>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div className="space-y-1">
                <Label><Tx>Company / Workspace Name</Tx></Label>
                <Input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sunrise Living Ltd."
                />
              </div>

              <div className="space-y-1">
                <Label><Tx>Workspace Slug (Read-only)</Tx></Label>
                <Input
                  disabled
                  value={tenant.slug}
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <Label><Tx>Contact Email</Tx></Label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="admin@example.com"
                />
              </div>

              <div className="space-y-1">
                <Label><Tx>Status</Tx></Label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-hidden focus:ring-2 focus:ring-ring"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                  <Tx>Cancel</Tx>
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? <Tx>Saving…</Tx> : <Tx>Save Changes</Tx>}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function SwitchOrgButton({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function handleSwitch() {
    setBusy(true);
    try {
      const res = await fetch("/api/organizations/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId })
      });
      const data = await res.json();
      if (!res.ok) {
        push({ title: "Failed to switch", description: data.message || "An error occurred", variant: "destructive" });
      } else {
        push({ title: "Switched Organization", description: `Active workspace is now ${tenantName}`, variant: "success" });
        router.refresh();
      }
    } catch {
      push({ title: "Error", description: "Network error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleSwitch} disabled={busy}>
      {busy ? <Tx>Switching…</Tx> : <Tx>Switch Workspace</Tx>}
    </Button>
  );
}

export function NewOrgModal({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [password, setPassword] = useState("");
  const [propertyName, setPropertyName] = useState("");

  if (!canCreate) return null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          contactEmail: email.trim() || null,
          adminName: adminName.trim() || undefined,
          adminEmail: adminEmail.trim() || undefined,
          password: password || undefined,
          initialPropertyName: propertyName.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) {
        push({ title: "Creation failed", description: data.message || "An error occurred", variant: "destructive" });
      } else {
        push({ title: "Workspace Created", description: `Organization ${data.tenant.name} is ready with full Owner & Super Admin permissions`, variant: "success" });
        setOpen(false);
        setName("");
        setSlug("");
        setEmail("");
        setAdminName("");
        setAdminEmail("");
        setPassword("");
        setPropertyName("");
        router.refresh();
      }
    } catch {
      push({ title: "Error", description: "Network connection error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Tx>+ New Workspace</Tx>
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl ring-1 ring-border">
            <h3 className="text-lg font-semibold"><Tx>Create Organization Workspace</Tx></h3>
            <p className="mt-1 text-xs text-muted-foreground">
              <Tx>Create a new isolated organization workspace with dedicated database partition and full Owner Super Admin permissions.</Tx>
            </p>

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label><Tx>Organization Name</Tx></Label>
                  <Input
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]/g, "-")) {
                        setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                      }
                    }}
                    placeholder="e.g. Acme Housing Group"
                  />
                </div>

                <div className="space-y-1">
                  <Label><Tx>Workspace URL Slug</Tx></Label>
                  <Input
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="e.g. acme-housing"
                  />
                </div>

                <div className="space-y-1">
                  <Label><Tx>Contact Email (Optional)</Tx></Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contact@acme.test"
                  />
                </div>
              </div>

              <div className="rounded-xl border bg-muted/20 p-3 space-y-3">
                <p className="text-xs font-semibold text-primary"><Tx>Owner / Super Admin Account (Optional)</Tx></p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs"><Tx>Admin Name</Tx></Label>
                    <Input
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs"><Tx>Admin Email</Tx></Label>
                    <Input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="owner@acme.test"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs"><Tx>Initial Password</Tx></Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Leave blank or min 6 chars"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label><Tx>Initial Property Name (Optional)</Tx></Label>
                <Input
                  value={propertyName}
                  onChange={(e) => setPropertyName(e.target.value)}
                  placeholder="e.g. Acme Central Residence"
                />
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
                  <Tx>Cancel</Tx>
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? <Tx>Creating…</Tx> : <Tx>Create Workspace</Tx>}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
