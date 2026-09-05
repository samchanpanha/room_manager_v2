/// Wrap untranslated JSX text in <Tx> using the offsets from
/// collect-untranslated.mjs, and ensure each file imports Tx.
///   node scripts/wrap-tx.mjs [--json /tmp/untranslated-ui.json]
import { readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv.indexOf("--json") >= 0 ? process.argv[process.argv.indexOf("--json") + 1] : "/tmp/untranslated-ui.json";
const records = JSON.parse(readFileSync(OUT, "utf8"));

const byFile = new Map();
for (const r of records) {
  if (!byFile.has(r.file)) byFile.set(r.file, []);
  byFile.get(r.file).push(r);
}

let changed = 0;
for (const [file, nodes] of byFile) {
  const src = readFileSync(file, "utf8");
  // apply end→start so offsets stay valid (also drop an existing Tx-wrapped region)
  const sorted = [...nodes].sort((a, b) => b.start - a.start);
  let out = src;
  for (const n of sorted) {
    const raw = src.slice(n.start, n.end);
    if (raw !== n.text) {
      console.error(`OFFSET DRIFT ${file}:${n.start} expected ${JSON.stringify(n.text.slice(0, 30))} got ${JSON.stringify(raw.slice(0, 30))}`);
      process.exit(1);
    }
    if (out.slice(n.start, n.end) !== n.text) {
      console.error(`DRIFT2 ${file}:${n.start}`);
      process.exit(1);
    }
    out = out.slice(0, n.start) + `<Tx>${n.text}</Tx>` + out.slice(n.end);
  }
  const anyNeedsImport = nodes.some((n) => n.needsImport);
  if (anyNeedsImport && !/import\s*\{[^}]*\bTx\b[^}]*\}\s*from\s*["']@\/components\/i18n-text["']/.test(out)) {
    const importLine = 'import { Tx } from "@/components/i18n-text";';
    const lastImport = [...out.matchAll(/^import\s[^\n]*;\s*$/gm)].pop();
    if (lastImport) {
      out = out.slice(0, lastImport.index + lastImport[0].length) + "\n" + importLine + out.slice(lastImport.index + lastImport[0].length);
    } else {
      // prepend (after "use client"/"use server"?)
      const m = out.match(/^(["']use (?:client|server)["'];\s*\n)/);
      out = m ? out.replace(m[1], m[1] + "\n" + importLine + "\n") : importLine + "\n\n" + out;
    }
  }
  writeFileSync(file, out);
  changed++;
}
console.error(`wrapped in ${changed} files`);