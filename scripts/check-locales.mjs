// Dev-time helper: lint the locale phrase tables in src/lib/locales —
//   • duplicate keys inside one locale block (TS also rejects these)
//   • the SAME key with DIFFERENT values across files (a merge conflict that
//     would silently pick a winner at runtime)
//   • km/zh parity (a phrase translated for one language must exist for both)
// Run: node scripts/check-locales.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = new URL("../src/lib/locales", import.meta.url).pathname;
const files = readdirSync(DIR).filter((f) => f.startsWith("ui-") && f.endsWith(".ts")).sort();
let problems = 0;
const seen = { km: new Map(), zh: new Map() };

for (const file of files) {
  const src = readFileSync(join(DIR, file), "utf8");
  const blocks = [...src.matchAll(/\n {2}(km|zh): \{([\s\S]*?)\n {2}\}/g)];
  const sets = {};
  for (const b of blocks) {
    const locale = b[1];
    // `\s*` between key and value: long entries are wrapped by Prettier onto
    // the next line, and a wrapped value must still count for parity checks.
    const keys = [...b[2].matchAll(/^ {4}"((?:[^"\\]|\\.)*)":\s*"((?:[^"\\]|\\.)*)"/gm)].map((m) => ({ key: m[1], value: m[2] }));
    sets[locale] = new Set();
    for (const { key } of keys) {
      if (sets[locale].has(key)) {
        console.log(`DUP ${locale} "${key}" in ${file}`);
        problems++;
      }
      sets[locale].add(key);
    }
    for (const { key, value } of keys) {
      const prev = seen[locale].get(key);
      if (prev) {
        if (prev.value !== value) {
          console.log(`CONFLICT ${locale} "${key}"  ${file}="${value}"  vs ${prev.file}="${prev.value}"`);
          problems++;
        }
      } else {
        seen[locale].set(key, { value, file });
      }
    }
  }
  console.log(`ok  ${file}  km=${sets.km?.size ?? 0} zh=${sets.zh?.size ?? 0}`);
}

for (const [k, v] of seen.km) if (!seen.zh.has(k)) { console.log(`ZH MISSING: "${k}" (${v.file})`); problems++; }
for (const [k, v] of seen.zh) if (!seen.km.has(k)) { console.log(`KM MISSING: "${k}" (${v.file})`); problems++; }
console.log(`TOTAL phrases: km=${seen.km.size} zh=${seen.zh.size}`);
console.log(problems === 0 ? "ALL CLEAN" : `${problems} PROBLEM(S)`);
const EXIT_CODE = problems === 0 ? 0 : 1;

// ── Optional coverage audit ─────────────────────────────────────────────────
// `node scripts/check-locales.mjs --audit` scans every .tsx for static JSX text
// nodes and reports which ones the phrase tables do NOT cover — i.e. the copy
// that will still render in English after a language switch. Wrapping such a
// node in <Tx> (or handing it to a translating primitive) plus adding the
// phrase to a dictionary closes the gap.
if (process.argv.includes("--audit")) {
  const AUTO = new Set([
    "TableHead", "Button", "Badge", "CardTitle", "CardDescription", "EmptyState",
    "Label", "Dialog", "StatCard", "PageHeader", "Textarea", "Input", "option", "Tx"
  ]);
  const ENT = { "&apos;": "'", "&#39;": "'", "&quot;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
  const normalize = (s) =>
    s
      .replace(/&(?:apos|#39|quot|amp|lt|gt|nbsp);/g, (m) => ENT[m] ?? m)
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/\u00a0/g, " ")
      .replace(/_/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const covered = new Set([...seen.km.keys(), ...seen.zh.keys()].map(normalize));

  const walk = (dir, out = []) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) walk(p, out);
      else if (entry.name.endsWith(".tsx")) out.push(p);
    }
    return out;
  };
  const ROOT = new URL("../src", import.meta.url).pathname;
  const tagText = /<([A-Za-z][\w.]*)((?:[^<>"]|"[^"]*")*)>([^<>]+?)<\/\1>/gs;

  let hits = 0;
  const uncovered = [];
  for (const file of walk(ROOT)) {
    if (file.includes("/components/ui/")) continue; // primitives translate themselves
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(tagText)) {
      const [, tag, , inner] = m;
      if (AUTO.has(tag) || inner.includes("{")) continue;
      const text = normalize(inner);
      if (text.length < 3 || !/[a-z]/.test(text)) continue;
      hits++;
      if (!covered.has(text)) {
        uncovered.push({ file: file.replace(ROOT + "/", ""), line: src.slice(0, m.index).split("\n").length, text: normalize(inner) });
      }
    }
  }
  console.log(`\nAUDIT static JSX text nodes: ${hits} · covered ${hits - uncovered.length} · uncovered ${uncovered.length}`);
  for (const u of uncovered.slice(0, 30)) console.log(`  ${u.file}:${u.line}  ${u.text.slice(0, 90)}`);
  if (uncovered.length > 30) console.log(`  … and ${uncovered.length - 30} more`);
  process.exit(EXIT_CODE);
}

process.exit(EXIT_CODE);
