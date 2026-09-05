/// i18n coverage audit — which authored English UI strings still have NO
/// km/zh entry in the phrase tables (src/lib/locales/ui-*.ts)?
///
///   node scripts/extract-strings.mjs && node scripts/i18n-coverage.mjs
///   node scripts/i18n-coverage.mjs --json /tmp/missing.json
///
/// Uses the same normalization as the runtime lookup (exact → normalized →
/// case-insensitive), so a phrase reported here really does render in English.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src/lib/locales");
const OUT = process.argv.indexOf("--json") >= 0 ? process.argv[process.argv.indexOf("--json") + 1] : null;

const ENTITIES = {
  "&apos;": "'", "&#39;": "'", "&amp;": "&", "&quot;": '"',
  "&lt;": "<", "&gt;": ">", "&nbsp;": " "
};

function normalizePhrase(text) {
  let s = text.replace(/&(?:apos|#39|amp|quot|lt|gt|nbsp);/g, (m) => ENTITIES[m] ?? m);
  s = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  s = s.replace(/[\u2013\u2014]/g, "-").replace(/\u00a0/g, " ");
  s = s.replace(/_/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

/// Harvest the English keys of every `km: { ... }` / `zh: { ... }` block by
/// scanning the source (avoids needing a TS runtime for the audit).
function keysFor(locale) {
  const keys = new Set();
  for (const file of readdirSync(ROOT).filter((f) => f.startsWith("ui-") && f.endsWith(".ts"))) {
    const src = readFileSync(path.join(ROOT, file), "utf8");
    const start = src.indexOf(`\n  ${locale}: {`);
    if (start < 0) continue;
    let depth = 0, i = src.indexOf("{", start), end = i;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    const block = src.slice(start, end);
    for (const m of block.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:/gm)) {
      keys.add(m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
    }
  }
  return keys;
}

function indexOf(keys) {
  const exact = new Set(), norm = new Set(), lower = new Set();
  for (const k of keys) {
    exact.add(k);
    const n = normalizePhrase(k);
    norm.add(n);
    lower.add(n.toLowerCase());
  }
  return { exact, norm, lower };
}

function covered(idx, text) {
  if (idx.exact.has(text)) return true;
  const n = normalizePhrase(text);
  if (!n) return true;
  return idx.norm.has(n) || idx.lower.has(n.toLowerCase());
}

const strings = JSON.parse(readFileSync(path.resolve(process.cwd(), "i18n-strings.json"), "utf8"));
const idx = { km: indexOf(keysFor("km")), zh: indexOf(keysFor("zh")) };

const missing = { km: [], zh: [] };
const byBucket = {};
for (const [bucket, list] of Object.entries(strings)) {
  if (bucket === "__all") continue;
  for (const text of list) {
    for (const locale of ["km", "zh"]) {
      if (!covered(idx[locale], text)) {
        missing[locale].push(text);
        (byBucket[bucket] ??= new Set()).add(text);
      }
    }
  }
}
missing.km = [...new Set(missing.km)].sort();
missing.zh = [...new Set(missing.zh)].sort();

for (const [bucket, set] of Object.entries(byBucket)) {
  console.log(`\n## ${bucket} (${set.size})`);
  for (const s of [...set].sort()) console.log(`  ${JSON.stringify(s)}`);
}
console.log(`\nMISSING km=${missing.km.length} zh=${missing.zh.length}`);
if (OUT) {
  writeFileSync(OUT, JSON.stringify(missing, null, 2));
  console.log(`→ ${OUT}`);
}
process.exit(missing.km.length + missing.zh.length > 0 ? 1 : 0);
