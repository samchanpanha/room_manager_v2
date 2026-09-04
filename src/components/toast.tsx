"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "destructive";
interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

const ToastContext = createContext<{ push: (t: { title: string; description?: string; variant?: ToastVariant }) => void } | null>(
  null
);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((t: { title: string; description?: string; variant?: ToastVariant }) => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, title: t.title, description: t.description, variant: t.variant ?? "default" }]);
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {items.map((i) => (
          <div
            key={i.id}
            className={cn(
              "pointer-events-auto rounded-lg border bg-card p-4 shadow-lg",
              i.variant === "success" && "border-success/40",
              i.variant === "destructive" && "border-destructive/40"
            )}
          >
            <p
              className={cn(
                "text-sm font-medium",
                i.variant === "success" && "text-success",
                i.variant === "destructive" && "text-destructive"
              )}
            >
              {i.title}
            </p>
            {i.description ? <p className="mt-0.5 text-sm text-muted-foreground">{i.description}</p> : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
