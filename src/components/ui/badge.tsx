"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";
import { txChildren } from "@/components/i18n-text";

type Variant = "default" | "secondary" | "outline" | "success" | "warning" | "destructive" | "info";

const variants: Record<Variant, string> = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  outline: "border border-input text-foreground",
  success: "bg-success/15 text-success border border-success/30",
  warning: "bg-warning/15 text-warning border border-warning/30",
  destructive: "bg-destructive/15 text-destructive border border-destructive/30",
  info: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30"
};

/// Status pills and labels. Text children run through the phrase table so enum
/// values (`paid`, `in_progress`, `breached`) and fixed labels follow the
/// active locale; unmatched children render exactly as given.
export function Badge({ className, variant = "default", children, title, ...props }: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  const { tUi } = useT();
  return (
    <span
      title={typeof title === "string" ? tUi(title) : title}
      className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", variants[variant], className)}
      {...props}
    >
      {txChildren(children, tUi)}
    </span>
  );
}
