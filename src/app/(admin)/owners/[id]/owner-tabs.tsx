"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";

interface PayoutMethodView {
  id: string;
  kind: string;
  bankName: string | null;
  accountName: string;
  accountNumber: string;
  isPrimary: boolean;
  notes: string | null;
}

interface BuildingView {
  id: string;
  label: string;
  floors: number;
  rooms: number;
  occupied: number;
}

interface DocumentView {
  id: string;
  docTypeId: string;
  docTypeName: string;
  fileName: string;
  sizeBytes: number;
  version: number;
  expiryDate: string | null;
  createdAt: string;
}

interface ProfileView {
  name: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  notes: string | null;
  status: string;
}

const TABS = ["Profile", "Payout methods", "Buildings", "Portal login", "Documents", "Activity"] as const;

export function OwnerTabs({
  ownerId,
  profile,
  payoutMethods,
  buildings,
  unownedBuildings,
  portalEmail,
  documents,
  docTypes,
  flags,
  activity
}: {
  ownerId: string;
  profile: ProfileView;
  payoutMethods: PayoutMethodView[];
  buildings: BuildingView[];
  unownedBuildings: Array<{ id: string; label: string }>;
  portalEmail: string | null;
  documents: DocumentView[];
  docTypes: Array<{ id: string; name: string }>;
  flags: { canUpdate: boolean; canReadDocs: boolean; canUploadDocs: boolean };
  activity: React.ReactNode;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Profile");

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              tab === t ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
            {t === "Buildings" && buildings.length > 0 ? ` (${buildings.length})` : ""}
            {t === "Documents" && documents.length > 0 ? ` (${documents.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "Profile" ? <ProfileTab ownerId={ownerId} profile={profile} canUpdate={flags.canUpdate} /> : null}
      {tab === "Payout methods" ? <PayoutTab ownerId={ownerId} methods={payoutMethods} canUpdate={flags.canUpdate} /> : null}
      {tab === "Buildings" ? <BuildingsTab ownerId={ownerId} buildings={buildings} unownedBuildings={unownedBuildings} canUpdate={flags.canUpdate} /> : null}
      {tab === "Portal login" ? <LoginTab ownerId={ownerId} portalEmail={portalEmail} canUpdate={flags.canUpdate} /> : null}
      {tab === "Documents" ? <DocumentsTab ownerId={ownerId} documents={documents} docTypes={docTypes} flags={flags} /> : null}
      {tab === "Activity" ? (
        <Card>
          <CardContent className="p-5">{activity}</CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ProfileTab({ ownerId, profile, canUpdate }: { ownerId: string; profile: ProfileView; canUpdate: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const res = await fetch(`/api/owners/${ownerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        phone: form.get("phone") || null,
        companyName: form.get("companyName") || null,
        notes: form.get("notes") || null,
        status: form.get("status")
      })
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Update failed", description: body.message, variant: "destructive" });
      return;
    }
    push({ title: "Owner updated", variant: "success" });
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="p-5">
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="op-name">Full name</Label>
              <Input id="op-name" name="name" defaultValue={profile.name} disabled={!canUpdate} required minLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="op-company">Company</Label>
              <Input id="op-company" name="companyName" defaultValue={profile.companyName ?? ""} disabled={!canUpdate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="op-email">Email</Label>
              <Input id="op-email" defaultValue={profile.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="op-phone">Phone</Label>
              <Input id="op-phone" name="phone" defaultValue={profile.phone ?? ""} disabled={!canUpdate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="op-status">Status</Label>
              <Select id="op-status" name="status" defaultValue={profile.status} disabled={!canUpdate}>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="op-notes">Notes</Label>
            <Textarea id="op-notes" name="notes" rows={2} defaultValue={profile.notes ?? ""} disabled={!canUpdate} />
          </div>
          {canUpdate ? (
            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Read-only (your OWNER role has view access to your own record).</p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function PayoutTab({ ownerId, methods, canUpdate }: { ownerId: string; methods: PayoutMethodView[]; canUpdate: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function addMethod(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const res = await fetch(`/api/owners/${ownerId}/payout-methods`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: form.get("kind"),
        bankName: form.get("bankName") || undefined,
        accountName: form.get("accountName"),
        accountNumber: form.get("accountNumber"),
        isPrimary: form.get("isPrimary") === "on"
      })
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Could not add method", description: body.message, variant: "destructive" });
      return;
    }
    push({ title: "Payout method added", variant: "success" });
    setOpen(false);
    router.refresh();
  }

  async function makePrimary(id: string) {
    setBusy(true);
    const res = await fetch(`/api/payout-methods/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimary: true })
    });
    setBusy(false);
    if (!res.ok) {
      push({ title: "Update failed", variant: "destructive" });
      return;
    }
    push({ title: "Primary payout method set", variant: "success" });
    router.refresh();
  }

  async function remove(id: string, tail: string) {
    if (!window.confirm(`Delete payout method ••••${tail}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/payout-methods/${id}`, { method: "DELETE" });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Delete failed", description: body.message, variant: "destructive" });
      return;
    }
    push({ title: "Payout method deleted", variant: "success" });
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Payout methods</p>
          {canUpdate ? <Button size="sm" onClick={() => setOpen(true)}>+ Add method</Button> : null}
        </div>
        <ul className="divide-y">
          {methods.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <p className="font-medium">
                  {m.kind}
                  {m.bankName ? ` · ${m.bankName}` : ""} {m.isPrimary ? <Badge variant="success" className="ml-1">primary</Badge> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.accountName} · ••••{m.accountNumber.slice(-4)}
                </p>
              </div>
              {canUpdate ? (
                <div className="flex gap-1.5">
                  {!m.isPrimary ? (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => makePrimary(m.id)}>
                      Make primary
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => remove(m.id, m.accountNumber.slice(-4))}>
                    Delete
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
          {methods.length === 0 ? <li className="py-3 text-sm text-muted-foreground">No payout methods on file.</li> : null}
        </ul>
      </CardContent>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add payout method">
        <form onSubmit={addMethod} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pm-kind">Kind</Label>
              <Select id="pm-kind" name="kind" defaultValue="BANK">
                <option value="BANK">Bank transfer</option>
                <option value="MOBILE_MONEY">Mobile money</option>
                <option value="CASH">Cash</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm-bank">Bank / provider</Label>
              <Input id="pm-bank" name="bankName" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm-accname">Account name</Label>
              <Input id="pm-accname" name="accountName" required minLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pm-accno">Account number</Label>
              <Input id="pm-accno" name="accountNumber" required minLength={3} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isPrimary" className="h-4 w-4" /> Set as primary
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

function BuildingsTab({
  ownerId,
  buildings,
  unownedBuildings,
  canUpdate
}: {
  ownerId: string;
  buildings: BuildingView[];
  unownedBuildings: Array<{ id: string; label: string }>;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState("");

  async function assign() {
    if (!selected) return;
    setBusy(true);
    const res = await fetch(`/api/owners/${ownerId}/buildings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buildingIds: [selected] })
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Assign failed", description: body.message, variant: "destructive" });
      return;
    }
    push({ title: "Building assigned", variant: "success" });
    setSelected("");
    router.refresh();
  }

  async function unassign(buildingId: string, label: string) {
    if (!window.confirm(`Remove ownership of "${label}" from this owner?`)) return;
    setBusy(true);
    const res = await fetch(`/api/owners/${ownerId}/buildings`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buildingIds: [buildingId] })
    });
    setBusy(false);
    if (!res.ok) {
      push({ title: "Unassign failed", variant: "destructive" });
      return;
    }
    push({ title: "Building unassigned", variant: "success" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <p className="mb-3 text-sm font-medium">Owned buildings</p>
          <ul className="divide-y">
            {buildings.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium">{b.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.floors} floors · {b.rooms} rooms · {b.rooms > 0 ? Math.round((b.occupied / b.rooms) * 100) : 0}% occupied
                  </p>
                </div>
                {canUpdate ? (
                  <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => unassign(b.id, b.label)}>
                    Unassign
                  </Button>
                ) : null}
              </li>
            ))}
            {buildings.length === 0 ? <li className="py-3 text-sm text-muted-foreground">No buildings yet.</li> : null}
          </ul>
        </CardContent>
      </Card>
      {canUpdate ? (
        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-medium">Assign an unowned building</p>
            {unownedBuildings.length === 0 ? (
              <p className="text-sm text-muted-foreground">Every building already has an owner.</p>
            ) : (
              <div className="flex items-end gap-2">
                <div className="min-w-64 flex-1 space-y-1.5">
                  <Label htmlFor="ab-select">Building</Label>
                  <Select id="ab-select" value={selected} onChange={(e) => setSelected(e.target.value)}>
                    <option value="">— choose —</option>
                    {unownedBuildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button disabled={!selected || busy} onClick={assign}>
                  {busy ? "Assigning…" : "Assign"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function LoginTab({ ownerId, portalEmail, canUpdate }: { ownerId: string; portalEmail: string | null; canUpdate: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const res = await fetch(`/api/owners/${ownerId}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Could not save login", description: body.message, variant: "destructive" });
      return;
    }
    push({ title: portalEmail ? "Password reset" : "Portal login created", variant: "success" });
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="p-5">
        <p className="mb-1 text-sm font-medium">Owner portal login</p>
        <p className="mb-4 text-xs text-muted-foreground">
          {portalEmail
            ? `Active login: ${portalEmail}. Submitting a new form below resets the password.`
            : "No portal login yet — create one so the owner can view their buildings, statements and documents."}
        </p>
        {canUpdate ? (
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pl-email">Email</Label>
              <Input id="pl-email" name="email" type="email" defaultValue={portalEmail ?? ""} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pl-pass">{portalEmail ? "New password" : "Temporary password"} (min 8)</Label>
              <Input id="pl-pass" name="password" type="password" required minLength={8} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : portalEmail ? "Reset password" : "Create login"}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground">Read-only.</p>
        )}
      </CardContent>
    </Card>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function DocumentsTab({
  ownerId,
  documents,
  docTypes,
  flags
}: {
  ownerId: string;
  documents: DocumentView[];
  docTypes: Array<{ id: string; name: string }>;
  flags: { canUpdate: boolean; canReadDocs: boolean; canUploadDocs: boolean };
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [docTypeId, setDocTypeId] = useState(docTypes[0]?.id ?? "");

  async function download(doc: DocumentView) {
    const res = await fetch(`/api/documents/${doc.id}/sign`, { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
    if (!res.ok || !body.url) {
      push({ title: "Download blocked", description: body.message, variant: "destructive" });
      return;
    }
    window.location.href = body.url;
  }

  async function submitUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      push({ title: "Choose a file first", variant: "destructive" });
      return;
    }
    setBusy(true);
    const up = new FormData();
    up.append("file", file);
    up.append("docTypeId", docTypeId);
    up.append("entity", "OWNER");
    up.append("entityId", ownerId);
    const res = await fetch("/api/documents", { method: "POST", body: up });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Upload failed", description: body.message, variant: "destructive" });
      return;
    }
    push({ title: "Document uploaded", variant: "success" });
    setOpen(false);
    form.reset();
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Documents (contracts, statements, ID…)</p>
          {flags.canUploadDocs ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              + Upload
            </Button>
          ) : null}
        </div>
        <ul className="divide-y">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <p className="font-medium">
                  {d.docTypeName} <Badge variant="outline">v{d.version}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {d.fileName} · {formatBytes(d.sizeBytes)}
                  {d.expiryDate ? ` · expires ${d.expiryDate.slice(0, 10)}` : ""}
                </p>
              </div>
              {flags.canReadDocs ? (
                <Button size="sm" variant="outline" onClick={() => download(d)}>
                  Download
                </Button>
              ) : null}
            </li>
          ))}
          {documents.length === 0 ? <li className="py-3 text-sm text-muted-foreground">No documents yet.</li> : null}
        </ul>
      </CardContent>
      <Dialog open={open} onClose={() => setOpen(false)} title="Upload owner document">
        <form onSubmit={submitUpload} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="od-type">Type</Label>
            <Select id="od-type" value={docTypeId} onChange={(e) => setDocTypeId(e.target.value)}>
              {docTypes.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="od-file">File (PDF/PNG/JPEG/WEBP, ≤10 MB)</Label>
            <Input id="od-file" name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" required />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}
