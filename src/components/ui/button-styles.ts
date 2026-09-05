/// Button class tokens — split out of the (client) Button component so server
/// components can style a `<Link>` as a button without crossing the client
/// boundary (a plain function cannot be imported from a "use client" module).
import { cn } from "@/lib/utils";

export type ButtonVariant = "default" | "outline" | "ghost" | "destructive" | "secondary" | "success";
export type ButtonSize = "default" | "sm" | "lg" | "icon";

export const buttonVariants: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
  outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
  ghost: "hover:bg-accent hover:text-accent-foreground",
  destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
  secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
  success: "bg-success text-success-foreground shadow-sm hover:bg-success/90"
};

export const buttonSizes: Record<ButtonSize, string> = {
  default: "h-9 px-4 py-2",
  sm: "h-8 rounded-md px-3 text-xs",
  lg: "h-10 rounded-md px-8",
  icon: "h-9 w-9"
};

export const buttonBaseClassName =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

/// Class helper for rendering a link-styled-as-button inside server components.
export function buttonClassName(variant: ButtonVariant = "default", size: ButtonSize = "default"): string {
  return cn(buttonBaseClassName, buttonVariants[variant], buttonSizes[size]);
}
