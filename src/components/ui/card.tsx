"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";
import { txChildren } from "@/components/i18n-text";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-xl border bg-card text-card-foreground shadow-sm", className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />;
}
/// Card titles translate their text children (section headings are UI copy).
export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  const { tUi } = useT();
  return (
    <h3 className={cn("font-semibold leading-none tracking-tight", className)} {...props}>
      {txChildren(children, tUi)}
    </h3>
  );
}
export function CardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  const { tUi } = useT();
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props}>
      {txChildren(children, tUi)}
    </p>
  );
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}
export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}
