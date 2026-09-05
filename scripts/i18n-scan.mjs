/// Wide i18n gap scan — AST walk over every src/*.ts(x) outside /api/,
/// collecting English-looking UI strings from the places the regex extractor
/// misses: JSX text, translatable JSX attributes, `label:` / `title:` /
/// `description:` / `hint:` object properties (column defs, nav/tab configs,
/// report metadata, module guides), and array-of-string label lists.
///
///   node scripts/i18n-scan.mjs            # report gaps grouped by file
///   node scripts/i18n-scan.mjs --json out.json
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const SRC = path.resolve(process.cwd(), "src");
const LOCALES_DIR = path.resolve(SRC, "lib/locales");
const OUT = process.argv.indexOf("--json") >= 0 ? process.argv[process.argv.indexOf("--json") + 1] : null;

const ENTITIES = { "&apos;": "'", "&#39;": "'", "&amp;": "&", "&quot;": '"', "&lt;": "<", "&gt;": ">", "&nbsp;": " " };
function normalizePhrase(text) {
  let s = text.replace(/&(?:apos|#39|amp|quot|lt|gt|nbsp);/g, (m) => ENTITIES[m] ?? m);
  s = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  s = s.replace(/[\u2013\u2014]/g, "-").replace(/\u00a0/g, " ");
  s = s.replace(/_/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

function keysFor(locale) {
  const keys = new Set();
  for (const file of readdirSync(LOCALES_DIR).filter((f) => f.startsWith("ui-") && f.endsWith(".ts"))) {
    const src = readFileSync(path.join(LOCALES_DIR, file), "utf8");
    const start = src.indexOf(`\n  ${locale}: {`);
    if (start < 0) continue;
    let depth = 0, i = src.indexOf("{", start), end = i;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
    }
    for (const m of src.slice(start, end).matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:/gm)) {
      keys.add(m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"));
    }
  }
  return keys;
}
function indexOf(keys) {
  const exact = new Set(), norm = new Set(), lower = new Set();
  for (const k of keys) { exact.add(k); const n = normalizePhrase(k); norm.add(n); lower.add(n.toLowerCase()); }
  return { exact, norm, lower };
}
function covered(idx, text) {
  if (idx.exact.has(text)) return true;
  const n = normalizePhrase(text);
  if (!n) return true;
  return idx.norm.has(n) || idx.lower.has(n.toLowerCase());
}

/// Attributes whose value reaches the user as visible text.
const TEXT_ATTRS = new Set([
  "title", "description", "label", "placeholder", "hint", "aria-label",
  "emptyLabel", "searchPlaceholder", "confirmLabel", "cancelLabel", "submitLabel",
  "heading", "subtitle", "caption", "tooltip", "helpText", "legend"
]);
/// Object-literal properties that carry user-visible copy in config tables.
const TEXT_PROPS = new Set([
  "label", "title", "description", "hint", "placeholder", "heading",
  "summary", "caption", "name", "text", "message", "help", "blurb", "tooltip"
]);
/// Property names that hold identifiers, not copy — never report these.
const SKIP_PROPS = new Set(["key", "id", "href", "value", "slug", "code", "icon", "path", "type", "kind"]);

/// Looks like a human sentence/label rather than data, an id or a token.
function isPhrase(v) {
  const s = v.trim();
  if (s.length < 2 || s.length > 220) return false;
  if (!/[A-Za-z]/.test(s)) return false;              // no letters → symbol/number
  if (!/[A-Za-z]{2}/.test(s)) return false;
  if (/^[a-z0-9]+([-_.][a-z0-9]+)+$/.test(s)) return false; // kebab/snake/dotted ids
  if (/^[a-z]+[A-Z]/.test(s) && !/\s/.test(s)) return false; // camelCase identifier
  if (/^(https?:|\/|#|\.\/|@)/.test(s)) return false;        // urls, paths, imports
  if (/^[A-Z0-9_]{2,}$/.test(s)) return false;               // CONST_TOKEN
  if (/^(use |cuid|px|rem|utf|application\/|text\/|image\/)/.test(s)) return false;
  if (/[<>{}$]/.test(s)) return false;                       // markup / template bits
  if (/^\d/.test(s) && !/\s/.test(s)) return false;
  return /\s/.test(s) || /^[A-Z]/.test(s);                   // a phrase or a Capitalised label
}

function walkFiles(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "api") walkFiles(full, out); }
    else if (/\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

const idx = { km: indexOf(keysFor("km")), zh: indexOf(keysFor("zh")) };
const files = walkFiles(SRC).filter((f) => !f.startsWith(LOCALES_DIR) && !f.endsWith("i18n.ts"));
const gaps = new Map(); // text -> Set(location)

for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  const sf = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const at = (node) => `${rel}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;
  const report = (text, node) => {
    if (!isPhrase(text)) return;
    if (covered(idx.km, text) && covered(idx.zh, text)) return;
    const key = normalizePhrase(text);
    if (!gaps.has(key)) gaps.set(key, { text, where: new Set() });
    gaps.get(key).where.add(at(node));
  };

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const t = node.text.trim();
      if (t) report(t, node);
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sf);
      if (TEXT_ATTRS.has(name)) {
        if (ts.isStringLiteral(node.initializer)) report(node.initializer.text, node);
        else if (ts.isJsxExpression(node.initializer) && node.initializer.expression &&
                 ts.isStringLiteral(node.initializer.expression)) {
          report(node.initializer.expression.text, node);
        }
      }
    } else if (ts.isPropertyAssignment(node)) {
      const name = ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) ? node.name.text : null;
      if (name && TEXT_PROPS.has(name) && !SKIP_PROPS.has(name)) {
        if (ts.isStringLiteral(node.initializer)) report(node.initializer.text, node);
        else if (ts.isArrayLiteralExpression(node.initializer)) {
          for (const el of node.initializer.elements) if (ts.isStringLiteral(el)) report(el.text, el);
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

const rows = [...gaps.values()].sort((a, b) => a.text.localeCompare(b.text));
for (const r of rows) console.log(`${JSON.stringify(r.text)}\n    ${[...r.where].slice(0, 4).join(", ")}`);
console.log(`\n${rows.length} untranslated UI phrases across ${files.length} files`);
if (OUT) writeFileSync(OUT, JSON.stringify(rows.map((r) => ({ text: r.text, where: [...r.where] })), null, 2));
process.exit(rows.length > 0 ? 1 : 0);
