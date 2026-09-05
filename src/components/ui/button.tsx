"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";
import { txChildren } from "@/components/i18n-text";
import { buttonBaseClassName, buttonSizes, buttonVariants, type ButtonSize, type ButtonVariant } from "./button-styles";

type Variant = ButtonVariant;
type Size = ButtonSize;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/// Buttons translate their own label: pages write `<Button>Save</Button>` and
/// the active locale decides what the user reads (§lib/i18n phrase table).
/// `title` and `aria-label` go through the same table.
/// NB: `buttonClassName` lives in ./button-styles (a plain module) so server
/// components can style links as buttons — client modules cannot export
/// callable helpers to the server.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = "default", size = "default", type = "button", disabled, children, title, "aria-label": ariaLabel, ...props },
    ref
  ) => {
    const { tUi } = useT();
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        title={typeof title === "string" ? tUi(title) : title}
        aria-label={typeof ariaLabel === "string" ? tUi(ariaLabel) : ariaLabel}
        className={cn(buttonBaseClassName, buttonVariants[variant], buttonSizes[size], className)}
        {...props}
      >
        {txChildren(children, tUi)}
      </button>
    );
  }
);
Button.displayName = "Button";
