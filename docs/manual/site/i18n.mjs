// Guide site i18n — aggregates the per-language content used by build.mjs.
//
// Three languages, mirroring the app's switchable UI (src/lib/i18n.ts):
//   en  — English  (source of truth; part text lives in docs/manual/*.md)
//   km  — Khmer    (part text: docs/manual/km/*.md)
//   zh  — Chinese  (part text: docs/manual/zh/*.md)
//
// Each language file (i18n/{en,km,zh}.mjs) exports:
//   meta        { code, native, htmlLang }
//   GROUP_NAMES [5 group labels, index-aligned with PARTS in build.mjs]
//   PART_LABELS { "<part-slug>": sidebar label }
//   UI          chrome strings (sidebar, home, part view, walks, buttons)
//   WALKS       [14 walkthroughs — same ids & step counts across languages]
//   DIAGRAMS    { "<part-slug>": { "<english-h2-slug>": { cap, nodes | formula } } }
// Diagram keys are the ENGLISH h2 slugs so km/zh diagrams line up 1:1 with
// the English source structure (the build validates this).

import * as en from "./i18n/en.mjs";
import * as km from "./i18n/km.mjs";
import * as zh from "./i18n/zh.mjs";

export const SITE_LOCALES = ["en", "km", "zh"];

export const SITE_LOCALE_META = {
  en: en.meta,
  km: km.meta,
  zh: zh.meta
};

export const GROUP_NAMES = {
  en: en.GROUP_NAMES,
  km: km.GROUP_NAMES,
  zh: zh.GROUP_NAMES
};

export const PART_LABELS = {
  en: en.PART_LABELS,
  km: km.PART_LABELS,
  zh: zh.PART_LABELS
};

export const UI = {
  en: en.UI,
  km: km.UI,
  zh: zh.UI
};

export const WALKS = {
  en: en.WALKS,
  km: km.WALKS,
  zh: zh.WALKS
};

export const DIAGRAMS = {
  en: en.DIAGRAMS,
  km: km.DIAGRAMS,
  zh: zh.DIAGRAMS
};
