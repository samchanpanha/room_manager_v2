"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";

interface DocTypeOpt {
  id: string;
  name: string;
  kycRequired: boolean;
  requiresExpiry: boolean;
}

interface StagedDoc {
  docTypeId: string;
  file: File;
  expiryDate?: string; // yyyy-mm-dd
}

interface ContactRow {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  isPrimary: boolean;
}

const STEPS = ["Personal", "Property & contacts", "KYC documents", "Review"] as const;

export function OnboardingWizard({
  properties,
  docTypes,
  uploadablePropertyIds
}: {
  properties: Array<{ id: string; label: string }>;
  docTypes: DocTypeOpt[];
  uploadablePropertyIds: string[];
}) {
  const router = useRouter();
  const { push } = useToast();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);

  // Step 1 — personal
  const [personal, setPersonal] = useState({
    name: "",
    email: "",
    phone: "",
    nationality: "",
    idNumber: "",
    occupation: "",
    monthlyIncome: "",
    notes: ""
  });

  // Step 2 — property + contacts
  const [homePropertyId, setHomePropertyId] = useState("");
  const [contacts, setContacts] = useState<ContactRow[]>([{ name: "", relationship: "", phone: "", isPrimary: true }]);

  // Step 3 — staged KYC docs
  const [docs, setDocs] = useState<StagedDoc[]>([]);

  const kycTypes = useMemo(() => docTypes.filter((d) => d.kycRequired), [docTypes]);
  const missingKyc = kycTypes.filter((t) => !docs.some((d) => d.docTypeId === t.id));

  const canUpload = homePropertyId === "" || uploadablePropertyIds.includes(homePropertyId);

  function setPersonalField(k: keyof typeof personal, v: string) {
    setPersonal((p) => ({ ...p, [k]: v }));
  }

  function setContact(i: number, patch: Partial<ContactRow>) {
    setContacts((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: personal.name,
          email: personal.email || undefined,
          phone: personal.phone || undefined,
          nationality: personal.nationality || undefined,
          idNumber: personal.idNumber || undefined,
          occupation: personal.occupation || undefined,
          monthlyIncome: personal.monthlyIncome ? Number(personal.monthlyIncome) : undefined,
          notes: personal.notes || undefined,
          homePropertyId: homePropertyId || undefined,
          emergencyContacts: contacts.map((c, i) => ({
            name: c.name,
            relationship: c.relationship,
            phone: c.phone,
            email: c.email || undefined,
            isPrimary: i === 0
          }))
        })
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok || !body.id) {
        push({ title: "Onboarding failed", description: body.message, variant: "destructive" });
        setBusy(false);
        return;
      }
      const memberId = body.id;

      // Upload staged documents (if the user holds M17:create for the property)
      if (docs.length > 0 && canUpload) {
        let uploaded = 0;
        for (const d of docs) {
          const fd = new FormData();
          fd.append("file", d.file);
          fd.append("docTypeId", d.docTypeId);
          fd.append("entity", "MEMBER");
          fd.append("entityId", memberId);
          if (d.expiryDate) fd.append("expiryDate", new Date(`${d.expiryDate}T00:00:00.000Z`).toISOString());
          const up = await fetch("/api/documents", { method: "POST", body: fd });
          if (up.ok) uploaded += 1;
        }
        if (uploaded < docs.length) {
          push({ title: `Member created, but only ${uploaded}/${docs.length} documents uploaded`, variant: "destructive" });
        }
      } else if (docs.length > 0 && !canUpload) {
        push({
          title: "Member created without documents",
          description: "Your roles lack M17:create for this property — upload the files later from the member page."
        });
      }

      push({ title: "Member onboarded", description: `${personal.name} created as prospect.`, variant: "success" });
      router.push(`/members/${memberId}`);
    } finally {
      setBusy(false);
    }
  }

  const stepValid =
    step === 0
      ? personal.name.trim().length >= 2
      : step === 1
        ? contacts.every((c) => c.name.trim().length >= 2 && c.relationship.trim().length >= 2 && c.phone.trim().length >= 5)
        : true;

  return (
    <div>
      {/* Stepper */}
      <ol className="mb-6 flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                i < step ? "bg-success text-white" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span className={cn("text-sm", i === step ? "font-medium" : "text-muted-foreground")}>{label}</span>
            {i < STEPS.length - 1 ? <span className="mx-1 text-muted-foreground/40">→</span> : null}
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="p-6">
          {step === 0 ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="w-name">Full name *</Label>
                  <Input id="w-name" value={personal.name} onChange={(e) => setPersonalField("name", e.target.value)} placeholder="Chan Ling" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="w-email">Email</Label>
                  <Input id="w-email" type="email" value={personal.email} onChange={(e) => setPersonalField("email", e.target.value)} placeholder="chan@example.test" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="w-phone">Phone</Label>
                  <Input id="w-phone" value={personal.phone} onChange={(e) => setPersonalField("phone", e.target.value)} placeholder="+855 12 345 678" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="w-nat">Nationality</Label>
                  <Input id="w-nat" value={personal.nationality} onChange={(e) => setPersonalField("nationality", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="w-idn">ID / passport number</Label>
                  <Input id="w-idn" value={personal.idNumber} onChange={(e) => setPersonalField("idNumber", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="w-occ">Occupation</Label>
                  <Input id="w-occ" value={personal.occupation} onChange={(e) => setPersonalField("occupation", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="w-inc">Monthly income (major units)</Label>
                  <Input id="w-inc" type="number" min="0" step="0.01" value={personal.monthlyIncome} onChange={(e) => setPersonalField("monthlyIncome", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="w-notes">Notes</Label>
                <Textarea id="w-notes" rows={2} value={personal.notes} onChange={(e) => setPersonalField("notes", e.target.value)} />
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="w-prop">Home property (drives access scoping)</Label>
                <Select id="w-prop" value={homePropertyId} onChange={(e) => setHomePropertyId(e.target.value)}>
                  <option value="">— unassigned —</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Emergency contacts *</p>
                <div className="space-y-3">
                  {contacts.map((c, i) => (
                    <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-4">
                      <Input placeholder="Name" value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} />
                      <Input placeholder="Relationship" value={c.relationship} onChange={(e) => setContact(i, { relationship: e.target.value })} />
                      <Input placeholder="Phone" value={c.phone} onChange={(e) => setContact(i, { phone: e.target.value })} />
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          disabled={contacts.length === 1}
                          onClick={() => setContacts((prev) => prev.filter((_, idx) => idx !== i))}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setContacts((prev) => [...prev, { name: "", relationship: "", phone: "", isPrimary: false }])}>
                  + Add contact
                </Button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="info">KYC checklist</Badge>
                {missingKyc.length === 0 ? (
                  <Badge variant="success">all required types staged</Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    still needed: {missingKyc.map((t) => t.name).join(", ")}
                  </span>
                )}
              </div>
              {!canUpload ? (
                <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                  Your roles cannot upload documents for the selected property (M17:create). You can still create the member and
                  attach files later from an account with document rights.
                </p>
              ) : null}
              {docTypes
                .filter((t) => t.kycRequired || t.id === "visa")
                .map((t) => {
                  const staged = docs.find((d) => d.docTypeId === t.id);
                  return (
                    <div key={t.id} className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_170px_auto]">
                      <div className="space-y-1.5">
                        <Label htmlFor={`doc-${t.id}`}>
                          {t.name} {t.kycRequired ? <span className="text-destructive">*</span> : <span className="text-muted-foreground">(optional)</span>}
                        </Label>
                        <Input
                          id={`doc-${t.id}`}
                          type="file"
                          accept="application/pdf,image/png,image/jpeg,image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            setDocs((prev) => {
                              const others = prev.filter((d) => d.docTypeId !== t.id);
                              return file ? [...others, { docTypeId: t.id, file, expiryDate: staged?.expiryDate }] : others;
                            });
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`exp-${t.id}`}>{t.requiresExpiry ? "Expires on" : "Expiry (n/a)"}</Label>
                        <Input
                          id={`exp-${t.id}`}
                          type="date"
                          disabled={!t.requiresExpiry}
                          value={staged?.expiryDate ?? ""}
                          onChange={(e) =>
                            setDocs((prev) => prev.map((d) => (d.docTypeId === t.id ? { ...d, expiryDate: e.target.value } : d)))
                          }
                        />
                      </div>
                      <div className="pb-1">
                        {staged ? <Badge variant="success">{staged.file.name.slice(0, 22)}</Badge> : <Badge variant="outline">none</Badge>}
                      </div>
                    </div>
                  );
                })}
              <p className="text-xs text-muted-foreground">
                Files upload right after the member record is created (PDF/PNG/JPEG/WEBP, ≤10 MB). Expiring docs trigger 30/7-day
                reminder events.
              </p>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border p-4">
                <p className="font-medium">{personal.name}</p>
                <p className="text-muted-foreground">
                  {personal.email || "no email"} · {personal.phone || "no phone"} · {personal.nationality || "—"} · ID {personal.idNumber || "—"}
                </p>
                <p className="text-muted-foreground">
                  {personal.occupation || "—"}
                  {personal.monthlyIncome ? ` · income ${personal.monthlyIncome}` : ""}
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Property</p>
                <p>{properties.find((p) => p.id === homePropertyId)?.label ?? "Unassigned"}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Emergency contacts</p>
                {contacts.map((c, i) => (
                  <p key={i}>
                    {c.name} · {c.relationship} · {c.phone}
                  </p>
                ))}
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documents</p>
                {docs.length === 0 ? (
                  <p className="text-muted-foreground">None staged</p>
                ) : (
                  docs.map((d) => (
                    <p key={d.docTypeId}>
                      {docTypes.find((t) => t.id === d.docTypeId)?.name}: {d.file.name}
                      {d.expiryDate ? ` (expires ${d.expiryDate})` : ""}
                    </p>
                  ))
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-between">
            <Button variant="outline" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
              ← Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button disabled={!stepValid} onClick={() => setStep((s) => s + 1)}>
                Next →
              </Button>
            ) : (
              <Button variant="success" disabled={busy} onClick={submit}>
                {busy ? "Creating…" : "Create member"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
