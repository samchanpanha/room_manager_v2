"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/i18n-provider";
import { txChildren, txOptions } from "@/components/i18n-text";

/// Inputs/textarea translate their `placeholder`; every other attribute is
/// passed through untouched.
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", placeholder, ...props }, ref) => {
    const { tUi } = useT();
    return (
      <input
        ref={ref}
        type={type}
        placeholder={typeof placeholder === "string" ? tUi(placeholder) : placeholder}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, placeholder, ...props }, ref) => {
    const { tUi } = useT();
    return (
      <textarea
        ref={ref}
        placeholder={typeof placeholder === "string" ? tUi(placeholder) : placeholder}
        className={cn(
          "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

/// Native select — the option labels are translated (values never are, so form
/// submissions keep sending the English enum values the API expects).
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => {
    const { tUi } = useT();
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-card",
          className
        )}
        {...props}
      >
        {txOptions(children, tUi)}
      </select>
    );
  }
);
Select.displayName = "Select";

export const Label = ({ className, children, title, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => {
  const { tUi } = useT();
  return (
    <label
      title={typeof title === "string" ? tUi(title) : title}
      className={cn("text-sm font-medium leading-none", className)}
      {...props}
    >
      {txChildren(children, tUi)}
    </label>
  );
};
