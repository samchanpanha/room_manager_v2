"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";
import { txChildren } from "@/components/i18n-text";

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-auto">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}
export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b", className)} {...props} />;
}
export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}
export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b transition-colors hover:bg-muted/50", className)} {...props} />;
}

/// Column headers translate themselves — this is the single reason table
/// columns follow the language switcher on every module screen without the
/// page holding any locale plumbing (§lib/i18n phrase table).
export function TableHead({ className, children, title, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  const { tUi } = useT();
  return (
    <th
      title={typeof title === "string" ? tUi(title) : title}
      className={cn("h-10 px-3 text-left align-middle font-medium text-muted-foreground", className)}
      {...props}
    >
      {txChildren(children, tUi)}
    </th>
  );
}

/// Data cells are NOT translated: they carry record values (names, codes,
/// amounts). Status pills inside them translate through `Badge`.
export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2.5 align-middle", className)} {...props} />;
}
