"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { useToast } from "@/components/toast";

/// §M25 "profile & KYC upload" — multipart upload straight into M17
/// (entity MEMBER, own id); the route refreshes the KYC checklist.
export function UploadForm({ entityId, docTypes }: { entityId: string; docTypes: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        fd.set("entity", "MEMBER");
        fd.set("entityId", entityId);
        setBusy(true);
        const res = await fetch("/api/documents", { method: "POST", body: fd });
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        setBusy(false);
        if (!res.ok) {
          push({ title: "Upload failed", description: data.message, variant: "destructive" });
          return;
        }
        push({ title: "Document uploaded", variant: "success" });
        form.reset();
        router.refresh();
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="u-type">Document type</Label>
        <Select id="u-type" name="docTypeId" required>
          {docTypes.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="u-file">File (PDF or image)</Label>
        <Input id="u-file" name="file" type="file" accept="application/pdf,image/*" required />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Uploading…" : "Upload document"}
      </Button>
    </form>
  );
}
