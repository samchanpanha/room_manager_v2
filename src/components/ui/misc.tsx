"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  const { tUi } = useT();
  return <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">{tUi(title)}</h1>{description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}</div>{actions ? <div className="flex items-center gap-2">{actions}</div> : null}</div>;
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  const { tUi } = useT();
  return <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center"><p className="text-sm font-medium text-muted-foreground">{tUi(title)}</p>{hint ? <p className="mt-1 text-xs text-muted-foreground/70">{hint}</p> : null}</div>;
}

export function StatCard({ label, value, sub, className }: { label: string; value: string | number; sub?: string; className?: string }) {
  const { tUi } = useT();
  return <div className={cn("rounded-xl border bg-card p-5 shadow-sm", className)}><p className="text-sm text-muted-foreground">{tUi(label)}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>{sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}</div>;
}
