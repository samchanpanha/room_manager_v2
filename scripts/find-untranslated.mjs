/// Find JSX text that is NOT guaranteed to be translated, so we can wrap it.
///   node scripts/find-untranslated.mjs
///
/// A JSXText node is considered "safe" when it is a direct string child of one
/// of the shared primitives that run txChildren/txOptions, or lives inside
/// <Tx>. Everything else is reported: raw <p>/<span>/<th>/<td>/<li>/<label>/...
/// text would render as the literal English phrase in khmer/chinese.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = path.resolve(process.cwd(), "src");
const SAFE = new Set([
  "Button",
  "Badge",
  "CardTitle",
  "CardDescription",
  "TableHead",
  "Label",
  "Input",
  "Textarea",
  "Select",
  "SearchableSelect",
  "Dialog",
  "PageHeader",
  "EmptyState",
  "StatCard",
  "Tx"
]);
const DATAISH = /^[\s0-9.,$%()+\-:/#){}\[\]"'·’‘.,!?]+$/;

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full).forEach((f) => out.push(f));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function parentElement(node) {
  const p = node.parent;
  return ts.isJsxElement(p) ? p : null;
}

function tagName(el) {
  const t = el.openingElement.tagName;
  if (ts.isIdentifier(t)) return t.text;
  if (ts.isPropertyAccessExpression(t)) return t.expression.getText(el.getSourceFile()) + "." + t.name.text;
  return null;
}

function tempVar(node) {
  if (ts.isJsxExpression(node)) {
    const e = node.expression;
    if (ts.isStringLiteral(e)) return { kind: "expr-str", value: e.text };
  }
  return null;
}

function report(file, node, why) {
  const { line, character } = file.getLineAndCharacterOfPosition(node.getStart());
  const text = JSON.stringify(node.getText().slice(0, 60).replace(/\s+/g, " "));
  console.log(`${file.fileName}:${line + 1}:${character + 1} ${why} ${text}`);
}

const files = walk(ROOT).sort();
let total = 0;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (!/\w/.test(text)) continue;
  for (const node of source.statements) {
    const nodes = [];
    (function collect(n) {
      if (ts.isJsxText(n)) nodes.push(n);
      ts.forEachChild(n, collect);
    })(node);
    for (const n of nodes) {
      const clean = n.getText().trim();
      if (!/[A-Za-z]/.test(clean)) continue; // only copy-like latin text
      if (DATAISH.test(clean)) continue; // amounts/codes stay as-is
      const parent = parentElement(n);
      const name = parent ? tagName(parent.element ?? parent) : null;
      if (name && SAFE.has(name)) continue;
      report(source, n, name ? `in <${name}>` : "bare-text");
      total++;
    }
  }
}
console.error(`\n${total} untranslated text nodes across ${files.length} tsx files`);