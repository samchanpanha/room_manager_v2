"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/toast";
import { Tx } from "@/components/i18n-text";

export interface TemplateSection {
  title: string;
  items: string[];
}

export interface InspectionTemplateItem {
  id: string;
  name: string;
  roomType: "STANDARD" | "DELUXE" | "STUDIO" | "SUITE";
  sections: TemplateSection[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function InspectionTemplatesCard({ canWrite }: { canWrite: boolean }) {
  const { push } = useToast();
  const [templates, setTemplates] = useState<InspectionTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);
  const [editTemplate, setEditTemplate] = useState<InspectionTemplateItem | null>(null);
  const [busy, setBusy] = useState(false);

  // Form states for Create/Edit
  const [name, setName] = useState("Standard condition checklist");
  const [roomType, setRoomType] = useState<"STANDARD" | "DELUXE" | "STUDIO" | "SUITE">("STANDARD");
  const [sections, setSections] = useState<TemplateSection[]>([
    { title: "Door & locks", items: ["Door closes and locks", "Keys handed over"] },
    { title: "Electrical", items: ["Lights work", "Outlets functional"] }
  ]);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/inspections/templates");
      const data = await res.json();
      if (res.ok && data.templates) {
        setTemplates(
          data.templates.map((t: { id: string; name: string; roomType: "STANDARD" | "DELUXE" | "STUDIO" | "SUITE"; sections: unknown; isActive: boolean; createdAt: string; updatedAt: string }) => ({
            ...t,
            sections: typeof t.sections === "string" ? JSON.parse(t.sections) : t.sections || []
          }))
        );
      }
    } catch {
      push({ title: "Could not load inspection templates", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [push]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  function handleOpenCreate() {
    setName("Standard condition checklist");
    setRoomType("STANDARD");
    setSections([
      { title: "Door & locks", items: ["Door closes and locks", "Keys / cards handed over", "Door peephole intact"] },
      { title: "Walls & ceiling", items: ["Walls clean, no holes", "Ceiling no leaks / stains", "Paint condition acceptable"] },
      { title: "Electrical", items: ["Lights work", "Outlets work", "Breaker panel labeled"] },
      { title: "Water & fixtures", items: ["No leaks under sinks", "Toilet flush + seal", "Shower drain & pressure"] },
      { title: "Safety", items: ["Smoke detector works", "Extinguisher charged"] }
    ]);
    setOpenCreate(true);
  }

  function handleOpenEdit(t: InspectionTemplateItem) {
    setEditTemplate(t);
    setName(t.name);
    setRoomType(t.roomType);
    setSections(t.sections || []);
  }

  function addSection() {
    setSections([...sections, { title: "New Section", items: ["Check item 1"] }]);
  }

  function updateSectionTitle(sIndex: number, newTitle: string) {
    setSections(sections.map((s, i) => (i === sIndex ? { ...s, title: newTitle } : s)));
  }

  function removeSection(sIndex: number) {
    setSections(sections.filter((_, i) => i !== sIndex));
  }

  function addItem(sIndex: number) {
    setSections(
      sections.map((s, i) => (i === sIndex ? { ...s, items: [...s.items, "New check item"] } : s))
    );
  }

  function updateItem(sIndex: number, itemIndex: number, text: string) {
    setSections(
      sections.map((s, i) =>
        i === sIndex
          ? {
              ...s,
              items: s.items.map((it, j) => (j === itemIndex ? text : it))
            }
          : s
      )
    );
  }

  function removeItem(sIndex: number, itemIndex: number) {
    setSections(
      sections.map((s, i) =>
        i === sIndex ? { ...s, items: s.items.filter((_, j) => j !== itemIndex) } : s
      )
    );
  }

  async function handleSave(isEdit: boolean) {
    if (!name.trim()) {
      push({ title: "Name required", variant: "destructive" });
      return;
    }
    if (sections.length === 0 || sections.some((s) => !s.title.trim() || s.items.length === 0)) {
      push({ title: "Each section must have a title and at least one item", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const url = isEdit && editTemplate ? `/api/inspections/templates/${editTemplate.id}` : "/api/inspections/templates";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, roomType, sections, isActive: true })
      });

      const data = await res.json();
      if (!res.ok) {
        push({ title: "Failed to save template", description: data.message, variant: "destructive" });
        return;
      }

      push({
        title: isEdit ? "Template updated" : "Template created",
        description: `Configured ${sections.length} section(s) for ${roomType}`,
        variant: "success"
      });

      setOpenCreate(false);
      setEditTemplate(null);
      void loadTemplates();
    } catch {
      push({ title: "Network error saving template", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete or deactivate this checklist template?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/inspections/templates/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        push({ title: "Could not delete template", description: data.message, variant: "destructive" });
        return;
      }
      push({ title: "Template deleted / deactivated", variant: "success" });
      void loadTemplates();
    } catch {
      push({ title: "Network error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card id="inspection-templates">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base"><Tx>Inspection Checklist Templates (M18)</Tx></CardTitle>
          <p className="text-xs text-muted-foreground">
            <Tx>Configure standard check items and sections per room type. Used during move-in, move-out, and periodic inspections.</Tx>
          </p>
        </div>
        {canWrite ? (
          <Button size="sm" onClick={handleOpenCreate}>
            <Tx>+ Add Template</Tx>
          </Button>
        ) : null}
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="py-6 text-center text-xs text-muted-foreground"><Tx>Loading templates…</Tx></div>
        ) : templates.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
            <p><Tx>No custom templates configured yet.</Tx></p>
            {canWrite ? (
              <Button variant="outline" size="sm" className="mt-3" onClick={handleOpenCreate}>
                <Tx>Create standard template</Tx>
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {templates.map((t) => {
                const totalItems = t.sections?.reduce((sum, s) => sum + (s.items?.length || 0), 0) || 0;
                return (
                  <div key={t.id} className="flex flex-col justify-between rounded-lg border bg-card p-3.5 shadow-sm space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between gap-1.5">
                        <Badge variant={t.roomType === "SUITE" ? "default" : t.roomType === "DELUXE" ? "info" : "secondary"}>
                          {t.roomType}
                        </Badge>
                        <Badge variant={t.isActive ? "outline" : "destructive"}>
                          {t.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <h4 className="mt-2 font-medium text-sm text-foreground">{t.name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {t.sections?.length || 0} <Tx>section(s)</Tx> · {totalItems} <Tx>items</Tx>
                      </p>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t">
                      <div className="max-h-24 overflow-y-auto space-y-1 text-[11px] text-muted-foreground pr-1">
                        {t.sections?.map((s, idx) => (
                          <div key={idx} className="truncate">
                            <span className="font-semibold text-foreground">{s.title}:</span> {s.items?.join(", ")}
                          </div>
                        ))}
                      </div>

                      {canWrite ? (
                        <div className="flex justify-end gap-1.5 pt-2">
                          <Button variant="outline" size="sm" className="h-7 text-xs px-2" onClick={() => handleOpenEdit(t)}>
                            <Tx>Edit Items</Tx>
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-destructive" onClick={() => handleDelete(t.id)}>
                            <Tx>Delete</Tx>
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>

      {/* Create / Edit Dialog */}
      <Dialog
        open={openCreate || Boolean(editTemplate)}
        onClose={() => {
          setOpenCreate(false);
          setEditTemplate(null);
        }}
        title={editTemplate ? "Edit Checklist Template" : "New Inspection Checklist Template"}
        description="Configure checklist sections and specific inspection items (e.g. locks, water, electricity, appliances)."
        wide
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name"><Tx>Template Name</Tx></Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Deluxe Room Condition Checklist"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-type"><Tx>Room Type</Tx></Label>
              <Select
                id="tpl-type"
                value={roomType}
                onChange={(e) => setRoomType(e.target.value as "STANDARD" | "DELUXE" | "STUDIO" | "SUITE")}
              >
                <option value="STANDARD">STANDARD</option>
                <option value="DELUXE">DELUXE</option>
                <option value="STUDIO">STUDIO</option>
                <option value="SUITE">SUITE</option>
              </Select>
            </div>
          </div>

          {/* Sections & Items Builder */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold"><Tx>Checklist Sections & Items</Tx></h4>
              <Button type="button" variant="outline" size="sm" onClick={addSection}>
                <Tx>+ Add Section</Tx>
              </Button>
            </div>

            {sections.map((sec, sIdx) => (
              <div key={sIdx} className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <Input
                      value={sec.title}
                      onChange={(e) => updateSectionTitle(sIdx, e.target.value)}
                      placeholder="Section Title (e.g. Doors & Windows)"
                      className="font-semibold text-sm h-8"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-destructive"
                    onClick={() => removeSection(sIdx)}
                  >
                    <Tx>Remove Section</Tx>
                  </Button>
                </div>

                <div className="pl-3 space-y-1.5 border-l-2 border-primary/30">
                  {sec.items.map((item, iIdx) => (
                    <div key={iIdx} className="flex items-center gap-2">
                      <Input
                        value={item}
                        onChange={(e) => updateItem(sIdx, iIdx, e.target.value)}
                        placeholder="Item (e.g. Check peephole and deadbolt lock)"
                        className="text-xs h-7"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(sIdx, iIdx)}
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-primary"
                    onClick={() => addItem(sIdx)}
                  >
                    <Tx>+ Add item to </Tx>&quot;{sec.title || "section"}&quot;
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpenCreate(false);
                setEditTemplate(null);
              }}
              disabled={busy}
            >
              <Tx>Cancel</Tx>
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={() => void handleSave(Boolean(editTemplate))}
              disabled={busy}
            >
              {busy ? <Tx>Saving…</Tx> : <Tx>Save Template</Tx>}
            </Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
