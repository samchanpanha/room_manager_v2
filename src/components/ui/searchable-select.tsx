"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/// Searchable combo-select. Every dropdown across the app uses this so list
/// choices (reports, properties, members, categories, …) are filterable by
/// typing instead of hunting through a long native `<select>`.
///
/// It is a drop-in for the native styled `<Select>` in `@/components/ui/input`:
///  - controlled mode: pass `value` + `onChange`
///  - uncontrolled (form) mode: pass `name` (+ optional `defaultValue`); a
///    hidden input mirrors the selection so `new FormData(form).get(name)`
///    still works exactly like a native `<select name=…>`
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyText,
  className,
  disabled,
  autoFocus,
  "aria-label": ariaLabel,
  name,
  defaultValue,
  required,
  id
}: {
  value?: string;
  onChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  "aria-label"?: string;
  name?: string;
  defaultValue?: string;
  required?: boolean;
  id?: string;
}) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState(defaultValue ?? value ?? "");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  const current = controlled ? value : internal;

  const selected = useMemo(() => options.find((o) => o.value === current), [options, current]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function commit(next: string) {
    if (!controlled) setInternal(next);
    onChange?.(next);
    setOpen(false);
    setQuery("");
  }

  // Keep the hidden input in sync for FormData-based submissions.
  useEffect(() => {
    if (hiddenRef.current) hiddenRef.current.value = current;
  }, [current]);

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      {/* For `<form>` submission: mirror the selection into a hidden input so
          FormData.read(name) behaves exactly like a native <select name>. */}
      {name ? (
        <input ref={hiddenRef} type="hidden" name={name} value={current} readOnly aria-hidden="true" />
      ) : null}
      <input
        ref={inputRef}
        id={id}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-controls="searchable-select-listbox"
        aria-haspopup="listbox"
        value={open ? query : selected?.label ?? ""}
        disabled={disabled}
        autoFocus={autoFocus}
        required={required}
        placeholder={selected && !open ? selected.label : placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
          // clear to "" when the user edits the box and the text no longer matches the current option
          if (selected && e.target.value.trim().toLowerCase() !== selected.label.toLowerCase()) commit("");
        }}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      />
      {open ? (
        <ul
          id="searchable-select-listbox"
          className="absolute z-50 mt-1 max-h-56 w-full min-w-[12rem] overflow-auto rounded-md border bg-popover p-1 shadow-md"
          role="listbox"
        >
          {filtered.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">{emptyText ?? "No matches"}</li>
          ) : (
            filtered.map((o) => {
              const active = o.value === current;
              const optionDisabled = o.disabled === true;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    aria-disabled={optionDisabled}
                    disabled={optionDisabled}
                    onClick={() => commit(o.value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                      active && "bg-accent",
                      optionDisabled && "cursor-not-allowed opacity-40"
                    )}
                  >
                    <span className="min-w-0 truncate">{o.label}</span>
                    {active ? <span className="shrink-0 text-primary">✓</span> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
