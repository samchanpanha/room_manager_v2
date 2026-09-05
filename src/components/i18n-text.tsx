"use client";

import { Children, cloneElement, isValidElement } from "react";
import { useT } from "@/components/i18n-provider";

/// UI-text translation for the shared primitives.
///
/// Pages author their copy in English (`<TableHead>Status</TableHead>`,
/// `<Button>Save</Button>`, `<Badge>{inv.status}</Badge>`). The primitives pass
/// those strings through the locale phrase table (§lib/i18n), which is why a
/// module screen translates without a single locale import of its own:
///
///   • string children are looked up (exact → normalized → case-insensitive);
///   • JSX children are walked one level so `<Button><Icon/>Save</Button>`
///     still translates the text next to the icon;
///   • `<option>` labels inside `Select` are cloned with their translation;
///   • anything that does not match a known phrase is rendered untouched, so
///     record data (names, codes, amounts) is never mistranslated.
///
/// `<Tx>` is the escape hatch for raw markup in a page (`<th>`, `<label>`,
/// `<p>`, `<button>`): wrap the text and it follows the active locale.
export type Translate = (text: string) => string;

const isText = (node: unknown): node is string => typeof node === "string";

/// Translate the plain-text parts of `children`, leaving elements alone.
export function txChildren(children: React.ReactNode, tUi: Translate): React.ReactNode {
  if (isText(children)) return tUi(children);
  if (Array.isArray(children)) {
    return children.map((child) => (isText(child) ? tUi(child) : child));
  }
  return children;
}

/// Translate `<option>` labels (and stray text) passed to a `<Select>`.
/// Children arrive pre-rendered from server components as plain elements, so
/// cloning them here is safe and keeps the value attributes untouched.
export function txOptions(children: React.ReactNode, tUi: Translate): React.ReactNode {
  return Children.map(children, (child) => {
    if (isText(child)) return tUi(child);
    if (!isValidElement(child)) return child;
    const props = child.props as { children?: React.ReactNode };
    if (child.type === "option" && isText(props.children)) {
      return cloneElement(child, undefined, tUi(props.children));
    }
    if (Array.isArray(props.children) && props.children.some(isText)) {
      return cloneElement(child, undefined, txChildren(props.children, tUi));
    }
    return child;
  });
}

/// Wrap raw text in a page so it follows the active locale.
export function Tx({ children }: { children: React.ReactNode }) {
  const { tUi } = useT();
  return <>{txChildren(children, tUi)}</>;
}

/// Hook form for components that render translated props (titles, placeholders).
export function useTx(): Translate {
  const { tUi } = useT();
  return tUi;
}
