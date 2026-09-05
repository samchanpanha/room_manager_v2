/// Emit machine-readable JSON of untranslated JSX text nodes for the Tx
/// codemod: node scripts/collect-untranslated.mjs [--json <out>] [--all]
/// (--all keeps src/lib pdfs; default excludes them)
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = path.resolve(process.cwd(), "src");
const ALL = process.argv.includes("--all");
const OUT = process.argv.indexOf("--json") >= 0 ? process.argv[process.argv.indexOf("--json") + 1] : "/tmp/untranslated-ui.json";
const SAFE = new Set([
  "Button", "Badge", "CardTitle", "CardDescription", "TableHead", "Label",
  "Input", "Textarea", "Select", "SearchableSelect", "Dialog", "PageHeader",
  "EmptyState", "StatCard", "Tx"
]);
const DATAISH = /^[\s0-9.,$%()+\-:/#){}\[\]"'·’‘.,!?]+$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const records = [];
const files = walk(ROOT).sort();
for (const file of files) {
  if (!ALL && /\/lib\/.*-pdf\.tsx$/.test(file.replace(/\\/g, "/"))) continue;
  const text = readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodes = [];
  for (const stmt of source.statements) {
    (function collect(n) {
      if (ts.isJsxText(n)) nodes.push(n);
      ts.forEachChild(n, collect);
    })(stmt);
  }
  let hasImport = false;
  for (const stmt of source.statements) {
    if (ts.isImportDeclaration(stmt) && stmt.moduleSpecifier.getText().includes("i18n-text")) hasImport = true;
  }
  for (const n of nodes) {
    const clean = n.getText().trim();
    if (!/[A-Za-z]/.test(clean)) continue;
    if (DATAISH.test(clean)) continue;
    const parent = n.parent;
    const name = ts.isJsxElement(parent) && ts.isIdentifier(parent.openingElement.tagName) ? parent.openingElement.tagName.text : "?";
    if (name && SAFE.has(name)) continue;
    records.push({
      file,
      start: n.getStart(),
      end: n.getEnd(),
      parent: name,
      needsImport: !hasImport,
      text: n.getText()
    });
  }
}
writeFileSync(OUT, JSON.stringify(records, null, 1));
console.error(`${records.length} nodes → ${OUT}`);