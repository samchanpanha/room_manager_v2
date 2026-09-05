/// Locale phrase tables — the engine behind `tUi()`.
///
/// Every UI string in the app is authored in English (the source of truth in
/// JSX). Translation is an EXACT-MATCH lookup of that English text in the
/// per-locale phrase tables below, so:
///   • nothing is ever machine-guessed at runtime — a phrase renders in English
///     until somebody files a translation for it;
///   • record data (names, codes, amounts) can never be mistranslated, because
///     only strings that match a known UI phrase are touched;
///   • adding coverage = adding lines to a table, no component surgery.
///
/// Lookup order (see `translateUi`):
///   1. exact text
///   2. normalized text — HTML entities decoded, curly quotes/dashes folded,
///      whitespace collapsed (JSX text nodes arrive with newlines + indent)
///   3. case-insensitive match (statuses render lower-case, labels Capitalised)
///   4. the nav/table label table (`nav.item.<Label>`)
///   5. the original English text
import type { Locale } from "@/lib/i18n";

/// English is the identity locale: phrase tables only carry translations.
export type PhraseTable = Record<Exclude<Locale, "en">, Record<string, string>>;

/// Merge any number of phrase tables. Later tables win on duplicates, and a
/// duplicate with a DIFFERENT value is a bug we want visible in tests — the
/// parity/duplication specs in tests/i18n.test.ts assert on `mergeConflicts`.
export const mergeConflicts: string[] = [];

export function mergePhrases(...tables: PhraseTable[]): PhraseTable {
  const out: PhraseTable = { km: {}, zh: {} };
  for (const table of tables) {
    for (const locale of Object.keys(out) as Array<Exclude<Locale, "en">>) {
      for (const [text, value] of Object.entries(table[locale] ?? {})) {
        const existing = out[locale][text];
        if (existing !== undefined && existing !== value) {
          mergeConflicts.push(`${locale}:${text}`);
        }
        out[locale][text] = value;
      }
    }
  }
  return out;
}

const ENTITIES: Record<string, string> = {
  "&apos;": "'",
  "&#39;": "'",
  "&amp;": "&",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
  "&nbsp;": " "
};

/// Fold the cosmetic differences between authored text and rendered text:
/// HTML entities, curly quotes/dashes, collapsed whitespace, and underscores —
/// enum values reach the screen both raw (`partial_paid`) and humanised
/// (`partial paid`), and one table entry must serve both.
export function normalizePhrase(text: string): string {
  let s = text.replace(/&(?:apos|#39|amp|quot|lt|gt|nbsp);/g, (m) => ENTITIES[m] ?? m);
  s = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  s = s.replace(/[\u2013\u2014]/g, "-").replace(/\u00a0/g, " ");
  s = s.replace(/_/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

/// One lookup structure per source table: exact → normalized → case-insensitive.
/// Keyed by table identity (WeakMap) so tests can build throwaway tables.
interface PhraseIndex {
  exact: Map<string, string>;
  normalized: Map<string, string>;
  lower: Map<string, string>;
}

const INDEX = new WeakMap<Record<string, string>, PhraseIndex>();

function buildIndex(table: Record<string, string>): PhraseIndex {
  const exact = new Map<string, string>();
  const normalized = new Map<string, string>();
  const lower = new Map<string, string>();
  for (const [text, value] of Object.entries(table)) {
    exact.set(text, value);
    const n = normalizePhrase(text);
    if (!normalized.has(n)) normalized.set(n, value);
    const l = n.toLowerCase();
    if (!lower.has(l)) lower.set(l, value);
  }
  return { exact, normalized, lower };
}

export function lookupPhrase(locale: Locale, table: PhraseTable, text: string): string | null {
  if (locale === "en") return null;
  const source = table[locale as Exclude<Locale, "en">];
  if (!source) return null;
  let index = INDEX.get(source);
  if (!index) {
    index = buildIndex(source);
    INDEX.set(source, index);
  }
  const hit = index.exact.get(text);
  if (hit !== undefined) return hit;
  const n = normalizePhrase(text);
  if (n.length === 0) return null;
  const normHit = index.normalized.get(n);
  if (normHit !== undefined) return normHit;
  const lowerHit = index.lower.get(n.toLowerCase());
  if (lowerHit !== undefined) return lowerHit;
  return null;
}
