"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/toast";

interface RoleOpt { id: string; name: string; key?: string; isProtected?: boolean }
interface PropertyOpt { id: string; name: string; code?: string }

async function api(url: string, method: string, body?: unknown): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.ok) return { ok: true };
  const data = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: false, message: data.message };
}

function CheckList({
  id,
  options,
  selected,
  onToggle
}: {
  id: string;
  options: Array<{ id: string; label: string }>;
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <div id={id} className="max-h-40 space-y-1.5 overflow-y-auto rounded-md border p-2">
      {options.length === 0 ? <p className="p-1 text-xs text-muted-foreground">None available</p> : null}
      {options.map((o) => (
        <label key={o.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selected.has(o.id)} onChange={() => onToggle(o.id)} className="h-4 w-4" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function NewUserButton({ roles, properties }: { roles: RoleOpt[]; properties: PropertyOpt[] }) {
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [roleIds, setRoleIds] = useState<Set<string>>(new Set());
  const [propertyIds, setPropertyIds] = useState<Set<string>>(new Set());

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const r = await api("/api/users", "POST", {
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      roleIds: [...roleIds],
      propertyIds: [...propertyIds]
    });
    setBusy(false);
    if (!r.ok) {
      push({ title: "Could not create user", description: r.message, variant: "destructive" });
      return;
    }
    push({ title: "User created", variant: "success" });
    setOpen(false);
    setRoleIds(new Set());
    setPropertyIds(new Set());
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ New user</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New user" description="Assign at least one role; property assignments limit PROPERTY-scoped permissions.">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Full name</Label>
              <Input id="u-name" name="name" required minLength={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">Email</Label>
              <Input id="u-email" name="email" type="email" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="u-pass">Password (min 8 chars)</Label>
            <Input id="u-pass" name="password" type="password" required minLength={8} />
          </div>
          <div className="space-y-1.5">
            <Label>Roles</Label>
            <CheckList id="u-roles" options={roles.map((r) => ({ id: r.id, label: r.name }))} selected={roleIds} onToggle={(id) => toggle(roleIds, setRoleIds, id)} />
          </div>
          <div className="space-y-1.5">
            <Label>Property assignments (empty = global reach for PROPERTY-scoped roles)</Label>
            <CheckList
              id="u-props"
              options={properties.map((p) => ({ id: p.id, label: p.name }))}
              selected={propertyIds}
              onToggle={(id) => toggle(propertyIds, setPropertyIds, id)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create user"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function UserRowActions({
  target,
  roles,
  properties,
  currentRoleIds,
  currentPropertyIds,
  isSelf
}: {
  target: { id: string; name: string; status: string };
  roles: RoleOpt[];
  properties: PropertyOpt[];
  currentRoleIds: string[];
  currentPropertyIds: string[];
  isSelf: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [roleIds, setRoleIds] = useState<Set<string>>(new Set(currentRoleIds));
  const [propertyIds, setPropertyIds] = useState<Set<string>>(new Set(currentPropertyIds));

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  async function toggleStatus() {
    const to = target.status === "active" ? "disabled" : "active";
    setBusy(true);
    const r = await api(`/api/users/${target.id}`, "PATCH", { status: to });
    setBusy(false);
    if (!r.ok) {
      push({ title: "Update failed", description: r.message, variant: "destructive" });
      return;
    }
    push({ title: `User ${to === "active" ? "enabled" : "disabled"}`, variant: "success" });
    router.refresh();
  }

  async function saveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    const r = await api(`/api/users/${target.id}`, "PATCH", {
      name: form.get("name"),
      roleIds: [...roleIds],
      propertyIds: [...propertyIds]
    });
    setBusy(false);
    if (!r.ok) {
      push({ title: "Update failed", description: r.message, variant: "destructive" });
      return;
    }
    push({ title: "User updated", variant: "success" });
    setEditOpen(false);
    router.refresh();
  }

  return (
    <div className="flex justify-end gap-1.5">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditOpen(true)}>
        Edit
      </Button>
      <Button size="sm" variant={target.status === "active" ? "destructive" : "success"} disabled={busy || isSelf} onClick={toggleStatus}>
        {target.status === "active" ? "Disable" : "Enable"}
      </Button>
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title={`Edit ${target.name}`}>
        <form onSubmit={saveEdit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor={`e-name-${target.id}`}>Full name</Label>
            <Input id={`e-name-${target.id}`} name="name" defaultValue={target.name} required minLength={2} />
          </div>
          <div className="space-y-1.5">
            <Label>Roles</Label>
            <CheckList
              id={`e-roles-${target.id}`}
              options={roles.map((r) => ({ id: r.id, label: r.isProtected ? `${r.name} (protected)` : r.name }))}
              selected={roleIds}
              onToggle={(id) => toggle(roleIds, setRoleIds, id)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Property assignments</Label>
            <CheckList
              id={`e-props-${target.id}`}
              options={properties.map((p) => ({ id: p.id, label: `${p.name}${p.code ? ` (${p.code})` : ""}` }))}
              selected={propertyIds}
              onToggle={(id) => toggle(propertyIds, setPropertyIds, id)}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
