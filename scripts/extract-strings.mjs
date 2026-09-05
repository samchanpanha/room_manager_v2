// Dev-time helper: harvest the English UI strings that the locale dictionaries
// must cover, grouped by the kind of element they render in. Not part of the
// runtime bundle — run with `node scripts/extract-strings.mjs`.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../src", import.meta.url).pathname;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx") || p.endsWith(".ts")) out.push(p);
  }
  return out;
}

const files = walk(ROOT).filter((f) => !f.includes("/api/"));
const buckets = {
  tableHead: new Set(),
  label: new Set(),
  button: new Set(),
  badge: new Set(),
  option: new Set(),
  cardTitle: new Set(),
  titleProp: new Set(),
  descriptionProp: new Set(),
  labelProp: new Set(),
  placeholder: new Set(),
  th: new Set(),
  rawLabel: new Set(),
  rawButton: new Set(),
  toast: new Set(),
  hint: new Set(),
  paragraph: new Set()
};

const STR = `(?:"((?:[^"\\\\]|\\\\.)*)"|'((?:[^'\\\\]|\\\\.)*)'|\\{\\s*"((?:[^"\\\\]|\\\\.)*)"\\s*\\})`;

function cap(s) {
  return (s ?? "").trim();
}
function add(bucket, s) {
  const v = cap(s);
  // Only plain prose: skip expressions, numbers, icons, urls.
  if (!v || /[{}<>]/.test(v) || /^[\d\s.%$,:·|/-]+$/.test(v) || v.startsWith("/")) return;
  buckets[bucket].add(v);
}

for (const file of files) {
  const src = readFileSync(file, "utf8");

  // <TableHead ...>Text</TableHead> (single-line, string child)
  for (const m of src.matchAll(/<TableHead[^>]*>\s*([^<{][^<]*?)\s*<\/TableHead>/g)) add("tableHead", m[1]);
  for (const m of src.matchAll(/<th[^>]*>\s*([^<{][^<]*?)\s*<\/th>/g)) add("th", m[1]);
  for (const m of src.matchAll(/<Label[^>]*>\s*([^<{][^<]*?)\s*<\/Label>/g)) add("label", m[1]);
  for (const m of src.matchAll(/<label[^>]*>\s*([^<{][^<]*?)\s*<\/label>/g)) add("rawLabel", m[1]);
  for (const m of src.matchAll(/<Button[^>]*>\s*([^<{][^<]*?)\s*<\/Button>/g)) add("button", m[1]);
  for (const m of src.matchAll(/<button[^>]*>\s*([^<{][^<]*?)\s*<\/button>/g)) add("rawButton", m[1]);
  for (const m of src.matchAll(/<Badge[^>]*>\s*([^<{][^<]*?)\s*<\/Badge>/g)) add("badge", m[1]);
  for (const m of src.matchAll(/<option[^>]*>\s*([^<{][^<]*?)\s*<\/option>/g)) add("option", m[1]);
  for (const m of src.matchAll(/<CardTitle[^>]*>\s*([^<{][^<]*?)\s*<\/CardTitle>/g)) add("cardTitle", m[1]);
  for (const m of src.matchAll(/<p[^>]*>\s*([^<{][^<]*?)\s*<\/p>/g)) add("paragraph", m[1]);

  for (const m of src.matchAll(new RegExp(`title=${STR}`, "g"))) add("titleProp", cap(m[1] ?? m[2] ?? m[3]));
  for (const m of src.matchAll(new RegExp(`description=${STR}`, "g"))) add("descriptionProp", cap(m[1] ?? m[2] ?? m[3]));
  for (const m of src.matchAll(new RegExp(`label=${STR}`, "g"))) add("labelProp", cap(m[1] ?? m[2] ?? m[3]));
  for (const m of src.matchAll(new RegExp(`placeholder=${STR}`, "g"))) add("placeholder", cap(m[1] ?? m[2] ?? m[3]));
  for (const m of src.matchAll(new RegExp(`hint=${STR}`, "g"))) add("hint", cap(m[1] ?? m[2] ?? m[3]));
  for (const m of src.matchAll(/push\(\s*\{[^}]*title:\s*"([^"]+)"/g)) add("toast", m[1]);
}

const report = {};
let total = 0;
for (const [k, set] of Object.entries(buckets)) {
  report[k] = [...set].sort();
  total += set.size;
}
const all = new Set();
for (const set of Object.values(buckets)) for (const v of set) all.add(v);
report.__all = [...all].sort();

writeFileSync(new URL("../i18n-strings.json", import.meta.url), JSON.stringify(report, null, 2));
for (const [k, v] of Object.entries(report)) if (k !== "__all") console.log(`${k}: ${v.length}`);
console.log(`DISTINCT TOTAL: ${all.size}`);
