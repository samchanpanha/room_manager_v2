"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}

/// Lightweight controlled dialog. Rendered through a portal onto document.body:
/// some parents (sticky headers with backdrop-blur, transforms) act as a
/// containing block for position:fixed children, which would clip the overlay.
export function Dialog({ open, onClose, title, description, children, wide }: DialogProps) {
  const { tUi } = useT();
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full rounded-xl border bg-card p-6 shadow-lg",
          wide ? "max-w-3xl" : "max-w-lg"
        )}
      >
        <h2 className="text-lg font-semibold">{tUi(title)}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{tUi(description)}</p> : null}
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}