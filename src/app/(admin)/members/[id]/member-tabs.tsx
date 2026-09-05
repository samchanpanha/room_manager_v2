"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { cn, titleCase } from "@/lib/utils";
import { Tx } from "@/components/i18n-text";

// ── View types (serialized from the server page) ────────────────────────────

interface MemberView {
  id: string;
  name: string;
  phone: string | null;
  nationality: string | null;
  idNumber: string | null;
  occupation: string | null;
  monthlyIncomeMinor: number | null;
  notes: string | null;
  status: string;
  blacklisted: boolean;
  blacklistReason: string | null;
  nextStatuses: string[];
}

interface ContactView {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  isPrimary: boolean;
}

interface DocumentView {
  id: string;
  docTypeId: string;
  docTypeName: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  expiryDate: string | null;
  notes: string | null;
  uploadedBy: string;
  createdAt: string;
  expired: boolean;
  expiringSoon: boolean;
}

interface DocTypeView {
  id: string;
  name: string;
  kycRequired: boolean;
  requiresExpiry: boolean;
}

interface Flags {
  canUpdate: boolean;
  canReadDocs: boolean;
  canUploadDocs: boolean;
  canDeleteDocs: boolean;
}

const TABS = ["Profile", "Contacts", "Documents", "Lease", "Ledger", "Activity"] as const;

export function MemberTabs({
  member,
  contacts,
  documents,
  docTypes,
  flags,
  activity
}: {
  member: MemberView;
  contacts: ContactView[];
  documents: DocumentView[];
  docTypes: DocTypeView[];
  flags: Flags;
  activity: React.ReactNode;
}) {
  const router = useRouter();
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
            {t === "Documents" && documents.length > 0 ? ` (${documents.length})` : ""}
            {t === "Contacts" && contacts.length > 0 ? ` (${contacts.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "Profile" ? <ProfileTab member={member} canUpdate={flags.canUpdate} /> : null}
      {tab === "Contacts" ? <ContactsTab memberId={member.id} contacts={contacts} canUpdate={flags.canUpdate} /> : null}
      {tab === "Documents" ? (
        <DocumentsTab memberId={member.id} documents={documents} docTypes={docTypes} flags={flags} />
      ) : null}
      {tab === "Lease" ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm font-medium text-muted-foreground"><Tx>No lease yet</Tx></p>
            <p className="mt-1 text-xs text-muted-foreground"><Tx>Leases & contracts arrive in Phase 5 — activation will live here.</Tx></p>
          </CardContent>
        </Card>
      ) : null}
      {tab === "Ledger" ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm font-medium text-muted-foreground"><Tx>No ledger entries yet</Tx></p>
            <p className="mt-1 text-xs text-muted-foreground"><Tx>The member account statement comes with the Ledger phase (7).</Tx></p>
          </CardContent>
        </Card>
      ) : null}
      {tab === "Activity" ? (
        <Card>
          <CardContent className="p-5">{activity}</CardContent>
        </Card>
      ) : null}
      <span className="hidden">{router ? "" : ""}</span>
    </div>
  );
}

// ── Profile tab ─────────────────────────────────────────────────────────────

function ProfileTab({ member, canUpdate }: { member: MemberView; canUpdate: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [blacklistOpen, setBlacklistOpen] = useState(false);
  const [mode, setMode] = useState<"blacklist" | "unblacklist">("blacklist");

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const res = await fetch(`/api/members/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        phone: form.get("phone") || null,
        nationality: form.get("nationality") || null,
        idNumber: form.get("idNumber") || null,
        occupation: form.get("occupation") || null,
        monthlyIncome: form.get("monthlyIncome") ? Number(form.get("monthlyIncome")) : null,
        notes: form.get("notes") || null
      })
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Update failed", description: body.message, variant: "destructive" });
      return;
    }
    push({ title: "Profile updated", variant: "success" });
    router.refresh();
  }

  async function transition(to: string) {
    setBusy(true);
    const res = await fetch(`/api/members/${member.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to })
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: `Cannot move to ${to}`, description: body.message, variant: "destructive" });
      return;
    }
    push({ title: `Member is now ${to}`, variant: "success" });
    router.refresh();
  }

  async function submitBlacklist(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const res = await fetch(`/api/members/${member.id}/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: form.get("reason") })
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Action failed", description: body.message, variant: "destructive" });
      return;
    }
    push({ title: mode === "blacklist" ? "Member blacklisted" : "Blacklist removed", variant: "success" });
    setBlacklistOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {member.blacklisted && member.blacklistReason ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <span className="font-medium"><Tx>Blacklisted:</Tx></span> {member.blacklistReason}
        </div>
      ) : null}

      <Card>
        <CardContent className="p-5">
          <p className="mb-3 text-sm font-medium"><Tx>Lifecycle</Tx></p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{member.status}</Badge>
            {member.nextStatuses.map((to) => (
              <Button key={to} size="sm" variant="outline" disabled={busy || !canUpdate} onClick={() => transition(to)}>
                → {titleCase(to)}
              </Button>
            ))}
            {member.nextStatuses.length === 0 && canUpdate ? (
              <span className="text-xs text-muted-foreground">terminal state{member.blacklisted ? " (blacklisted)" : ""}</span>
            ) : null}
          </div>
          {canUpdate ? (
            <div className="mt-3 border-t pt-3">
              <Button
                size="sm"
                variant={member.blacklisted ? "secondary" : "destructive"}
                disabled={busy}
                onClick={() => {
                  setMode(member.blacklisted ? "unblacklist" : "blacklist");
                  setBlacklistOpen(true);
                }}
              >
                {member.blacklisted ? "Remove blacklist" : "Blacklist member"}
              </Button>
              <span className="ml-2 text-xs text-muted-foreground"><Tx>requires a written reason; always audited</Tx></span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canUpdate ? (
        <Card>
          <CardContent className="p-5">
            <p className="mb-3 text-sm font-medium"><Tx>Edit profile</Tx></p>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="mp-name">Full name</Label>
                  <Input id="mp-name" name="name" defaultValue={member.name} required minLength={2} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mp-phone">Phone</Label>
                  <Input id="mp-phone" name="phone" defaultValue={member.phone ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mp-nat">Nationality</Label>
                  <Input id="mp-nat" name="nationality" defaultValue={member.nationality ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mp-idn">ID / passport number</Label>
                  <Input id="mp-idn" name="idNumber" defaultValue={member.idNumber ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mp-occ">Occupation</Label>
                  <Input id="mp-occ" name="occupation" defaultValue={member.occupation ?? ""} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mp-inc">Monthly income (major)</Label>
                  <Input
                    id="mp-inc"
                    name="monthlyIncome"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={member.monthlyIncomeMinor === null ? "" : (member.monthlyIncomeMinor / 100).toFixed(2)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mp-notes">Notes</Label>
                <Textarea id="mp-notes" name="notes" rows={2} defaultValue={member.notes ?? ""} />
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={busy}>
                  {busy ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 text-sm text-muted-foreground"><Tx>Read-only access (M02:read).</Tx></CardContent>
        </Card>
      )}

      <Dialog
        open={blacklistOpen}
        onClose={() => setBlacklistOpen(false)}
        title={mode === "blacklist" ? "Blacklist member" : "Remove blacklist"}
        description="A written reason is mandatory and recorded in the audit trail."
      >
        <form onSubmit={submitBlacklist} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="bl-reason">Reason</Label>
            <Textarea id="bl-reason" name="reason" rows={3} required minLength={3} maxLength={500} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setBlacklistOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant={mode === "blacklist" ? "destructive" : "success"} disabled={busy}>
              {busy ? "Working…" : mode === "blacklist" ? "Blacklist" : "Remove blacklist"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

// ── Contacts tab ────────────────────────────────────────────────────────────

function ContactsTab({ memberId, contacts, canUpdate }: { memberId: string; contacts: ContactView[]; canUpdate: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function addContact(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const res = await fetch(`/api/members/${memberId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        relationship: form.get("relationship"),
        phone: form.get("phone"),
        email: form.get("email") || undefined
      })
    });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Could not add contact", description: body.message, variant: "destructive" });
      return;
    }
    push({ title: "Contact added", variant: "success" });
    setOpen(false);
    router.refresh();
  }

  async function removeContact(id: string, name: string) {
    if (!window.confirm(`Remove emergency contact "${name}"?`)) return;
    setBusy(true);
    const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      push({ title: "Could not remove contact", variant: "destructive" });
      return;
    }
    push({ title: "Contact removed", variant: "success" });
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium"><Tx>Emergency contacts</Tx></p>
          {canUpdate ? <Button size="sm" onClick={() => setOpen(true)}>+ Add contact</Button> : null}
        </div>
        <ul className="divide-y">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div>
                <p className="font-medium">
                  {c.name} {c.isPrimary ? <Badge variant="secondary" className="ml-1">primary</Badge> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c.relationship} · {c.phone}
                  {c.email ? ` · ${c.email}` : ""}
                </p>
              </div>
              {canUpdate ? (
                <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => removeContact(c.id, c.name)}>
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
          {contacts.length === 0 ? <li className="py-3 text-sm text-muted-foreground"><Tx>No contacts on file.</Tx></li> : null}
        </ul>
      </CardContent>
      <Dialog open={open} onClose={() => setOpen(false)} title="Add emergency contact">
        <form onSubmit={addContact} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ec-name">Name</Label>
              <Input id="ec-name" name="name" required minLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ec-rel">Relationship</Label>
              <Input id="ec-rel" name="relationship" required minLength={2} placeholder="Sibling / Spouse…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ec-phone">Phone</Label>
              <Input id="ec-phone" name="phone" required minLength={5} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ec-email">Email (optional)</Label>
              <Input id="ec-email" name="email" type="email" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Adding…" : "Add contact"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

// ── Documents tab ───────────────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function DocumentsTab({
  memberId,
  documents,
  docTypes,
  flags
}: {
  memberId: string;
  documents: DocumentView[];
  docTypes: DocTypeView[];
  flags: Flags;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  async function download(doc: DocumentView) {
    const res = await fetch(`/api/documents/${doc.id}/sign`, { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
    if (!res.ok || !body.url) {
      push({ title: "Download blocked", description: body.message, variant: "destructive" });
      return;
    }
    window.location.href = body.url;
  }

  async function remove(doc: DocumentView) {
    if (!window.confirm(`Delete "${doc.fileName}"? The stored object is removed and the action is audited.`)) return;
    setBusy(true);
    const res = await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      push({ title: "Delete failed", variant: "destructive" });
      return;
    }
    push({ title: "Document deleted", variant: "success" });
    router.refresh();
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium"><Tx>Documents</Tx></p>
          {flags.canUploadDocs ? (
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              + Upload document
            </Button>
          ) : null}
        </div>
        {documents.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground"><Tx>No documents on file.</Tx></p>
        ) : (
          <ul className="divide-y">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {d.docTypeName} <Badge variant="outline">v{d.version}</Badge>
                    {d.expired ? <Badge variant="destructive">expired</Badge> : d.expiringSoon ? <Badge variant="warning">expiring ≤45d</Badge> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.fileName} · {formatBytes(d.sizeBytes)}
                    {d.expiryDate ? ` · expires ${d.expiryDate.slice(0, 10)}` : ""} · by {d.uploadedBy}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {flags.canReadDocs ? (
                    <Button size="sm" variant="outline" onClick={() => download(d)}>
                      Download
                    </Button>
                  ) : null}
                  {flags.canDeleteDocs ? (
                    <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => remove(d)}>
                      Delete
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <UploadDialog memberId={memberId} docTypes={docTypes} open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </Card>
  );
}

function UploadDialog({ memberId, docTypes, open, onClose }: { memberId: string; docTypes: DocTypeView[]; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [docTypeId, setDocTypeId] = useState(docTypes[0]?.id ?? "");
  const selected = docTypes.find((d) => d.id === docTypeId);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      push({ title: "Choose a file first", variant: "destructive" });
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("docTypeId", docTypeId);
    fd.append("entity", "MEMBER");
    fd.append("entityId", memberId);
    const expiry = form.get("expiryDate");
    if (expiry) fd.append("expiryDate", new Date(`${expiry}T00:00:00.000Z`).toISOString());
    const notes = form.get("notes");
    if (notes) fd.append("notes", String(notes));

    const res = await fetch("/api/documents", { method: "POST", body: fd });
    const body = (await res.json().catch(() => ({}))) as { message?: string; kycCompleted?: boolean };
    setBusy(false);
    if (!res.ok) {
      push({ title: "Upload failed", description: body.message, variant: "destructive" });
      return;
    }
    push({
      title: "Document uploaded",
      description: body.kycCompleted ? "KYC checklist is now complete." : undefined,
      variant: "success"
    });
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Upload document" description="Private storage — access only via short-TTL signed URLs.">
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="up-type">Document type</Label>
          <Select id="up-type" value={docTypeId} onChange={(e) => setDocTypeId(e.target.value)}>
            {docTypes.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.kycRequired ? " (KYC)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="up-file">File (PDF/PNG/JPEG/WEBP, ≤10 MB)</Label>
          <Input id="up-file" name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" required />
        </div>
        {selected?.requiresExpiry ? (
          <div className="space-y-1.5">
            <Label htmlFor="up-exp">Expires on</Label>
            <Input id="up-exp" name="expiryDate" type="date" />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="up-notes">Notes</Label>
          <Input id="up-notes" name="notes" placeholder="optional" />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
