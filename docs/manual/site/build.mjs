// Builds a self-contained single-page documentation site from the manual .md
// files, in the app's three switchable languages:
//   en — English (docs/manual/*.md — source of truth)
//   km — Khmer   (docs/manual/km/*.md)
//   zh — Chinese (docs/manual/zh/*.md)
// Run: node docs/manual/site/build.mjs   ->   docs/manual/site/index.html
// Also published into the Next.js public/ folder (in-app at /guide).
//
// Structural contract: km/zh parts must mirror the English parts' h2
// structure 1:1 (same count, same order). Section anchors always use the
// ENGLISH slugs, so the same link works in every language. The build warns
// on any drift instead of failing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_LOCALES, SITE_LOCALE_META, GROUP_NAMES, PART_LABELS, UI, WALKS, DIAGRAMS } from "./i18n.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const manualDir = path.resolve(here, "..");

const PARTS = [
  { file: "01-system-overview.md", g: 0 },
  { file: "02-quick-start.md", g: 0 },
  { file: "03-user-guide.md", g: 1 },
  { file: "04-business-workflows.md", g: 1 },
  { file: "05-financial-accounting-guide.md", g: 2 },
  { file: "06-reports-guide.md", g: 2 },
  { file: "07-telegram-notifications.md", g: 2 },
  { file: "08-administrator-guide.md", g: 3 },
  { file: "09-security-guide.md", g: 3 },
  { file: "10-troubleshooting.md", g: 4 },
  { file: "11-faq.md", g: 4 },
  { file: "12-glossary.md", g: 4 },
  { file: "13-golden-paths.md", g: 4 }
];

const fileSlug = (f) => f.replace(/\.md$/, "");
const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
const normDashes = (s) => s.replace(/-+/g, "-");

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Diagram rendering (data-driven, shared by all languages) ──
function nodeHtml(n) {
  const [a, b] = n;
  const v = a && /^v-(?:blue|green|amber|teal)$/.test(a) ? a : "";
  const t = v ? b : a;
  return `<div class="flow-node ${v}">${esc(t)}</div>`;
}

function inlineMd(s) {
  // plain inline markdown for diagram formula rows (no links)
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
}

function renderDiagram(spec) {
  if (spec.formula) {
    const rows = spec.formula.rows;
    const body = rows
      .map(
        (r, i) =>
          `<div class="formula-row">${inlineMd(r)}</div>${i === rows.length - 2 ? '<div class="formula-rule"></div>' : ""}`
      )
      .join("");
    return `<figure class="diagram"><figcaption>${esc(spec.cap)}</figcaption><div class="formula"><div class="formula-title">${esc(spec.formula.title)}</div>${body}</div></figure>`;
  }
  const arrow = spec.horiz ? '<div class="flow-arrow flow-arrow-h">→</div>' : '<div class="flow-arrow">↓</div>';
  const nodes = spec.nodes.map(nodeHtml).join(arrow);
  return `<figure class="diagram"><figcaption>${esc(spec.cap)}</figcaption><div class="flow${spec.horiz ? " flow-h" : ""}">${nodes}</div></figure>`;
}

// ── Markdown → HTML (per part, per language) ──
function h2Texts(md) {
  return md
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((l) => /^##\s+/.test(l))
    .map((l) => l.replace(/^##\s+/, "").trim());
}

function table(rows, inline) {
  const parse = (l) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
  const header = parse(rows[0]);
  const body = rows.slice(2).map(parse);
  let h = '<div class="table-wrap"><table><thead><tr>';
  for (const c of header) h += `<th>${inline(c)}</th>`;
  h += "</tr></thead><tbody>";
  for (const r of body) {
    h += "<tr>";
    for (const c of r) h += `<td>${inline(c)}</td>`;
    h += "</tr>";
  }
  h += "</tbody></table></div>";
  return h;
}

// `ids`: section ids for this part, in h2 order (always English-slug based,
// so anchors are stable across languages).
function convert(md, partSlug, locale, ids) {
  const prefix = `sec-${partSlug}-`;
  const idByNormAnchor = new Map();
  for (const id of ids) {
    if (id.startsWith(prefix)) idByNormAnchor.set(normDashes(id.slice(prefix.length)), id);
  }

  const inline = (s) => {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    // links [text](href) — rewrite .md links to internal routes, and
    // in-part #anchors to the full `#/part/{slug}#sec-...` hash route
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, href) => {
      const mm = href.match(/^(\d{2}-[a-z0-9-]+)\.md(?:#(.*))?$/);
      if (mm) {
        const target = mm[1];
        const frag = mm[2] ? `#sec-${target}-${normDashes(mm[2])}` : "";
        return `<a href="#/part/${target}${frag}" class="inlink">${text}</a>`;
      }
      const am = href.match(/^#([\w.:-]+)$/);
      if (am && idByNormAnchor.has(normDashes(am[1]))) {
        return `<a href="#/part/${partSlug}#${idByNormAnchor.get(normDashes(am[1]))}" class="inlink">${text}</a>`;
      }
      return `<a href="${esc(href)}" target="_blank" rel="noopener">${text}</a>`;
    });
    return s;
  };

  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  const toc = [];
  let i = 0;
  let h2Index = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code
    if (line.trim().startsWith("```")) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { buf.push(lines[i]); i++; }
      i++;
      out.push(`<pre class="code">${esc(buf.join("\n"))}</pre>`);
      continue;
    }
    // table
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i]); i++; }
      out.push(table(rows, inline));
      continue;
    }
    // headings
    const hm = line.match(/^(#{1,4})\s+(.*)$/);
    if (hm) {
      const level = hm[1].length;
      const text = hm[2].trim();
      if (level === 2) {
        h2Index++;
        const id = ids[h2Index - 1] || `sec-${partSlug}-h2-${h2Index}`;
        const anchor = id.startsWith(prefix) ? id.slice(prefix.length) : `h2-${h2Index}`;
        toc.push({ n: h2Index, anchor, text });
        out.push(`<h2 id="${id}"><span class="sec-no">${h2Index}</span>${inline(text)}</h2>`);
        // Diagram lookup: exact English-slug key first, then fuzzy match
        // (heading numbers like "13." vary across key styles).
        const table = DIAGRAMS[locale] && DIAGRAMS[locale][partSlug];
        let spec = table && table[anchor];
        if (!spec && table) {
          const words = normDashes(anchor).replace(/^\d+-/, "");
          const key = Object.keys(table).find((k) => normDashes(anchor) === k || normDashes(anchor).endsWith(normDashes(k).replace(/^\d+-/, "")) || k.endsWith(words));
          if (key) spec = table[key];
        }
        if (spec) out.push(renderDiagram(spec));
      } else if (level === 1) {
        out.push(`<h1 class="part-title">${inline(text)}</h1>`);
      } else if (level === 3) {
        out.push(`<h3 id="${`sec-${partSlug}-${slugify(text)}`}">${inline(text)}</h3>`);
      } else {
        out.push(`<h4>${inline(text)}</h4>`);
      }
      i++;
      continue;
    }
    // hr
    if (/^\s*---+\s*$/.test(line)) { out.push('<hr class="soft">'); i++; continue; }
    // blockquote
    if (/^\s*>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, "")); i++; }
      const joined = buf.join(" ").trim();
      const cls = joined.startsWith("🚫") ? "note note-danger" : joined.startsWith("⚠️") ? "note note-warn" : "note";
      out.push(`<aside class="${cls}">${inline(joined)}</aside>`);
      continue;
    }
    // list
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
        items.push(lines[i].replace(/^\s*(?:[-*]|\d+\.)\s+/, ""));
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((t) => `<li>${inline(t)}</li>`).join("")}</${tag}>`);
      continue;
    }
    // blank
    if (line.trim() === "") { i++; continue; }
    // paragraph (gather until blank/special)
    const buf = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^(#{1,4})\s/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*\|.*\|\s*$/.test(lines[i]) &&
      !lines[i].trim().startsWith("```") &&
      !/^\s*---+\s*$/.test(lines[i])
    ) { buf.push(lines[i]); i++; }
    out.push(`<p>${inline(buf.join(" "))}</p>`);
  }
  return { html: out.join("\n"), toc };
}

function dataUri(p) {
  const b64 = fs.readFileSync(p).toString("base64");
  return `data:image/png;base64,${b64}`;
}

const img = {
  hero: dataUri(path.join(here, "img/hero.png")),
  tenant: dataUri(path.join(here, "img/tenant-mobile.png")),
  admin: dataUri(path.join(here, "img/admin-security.png"))
};

// ── Build every part for every language ──
const enSlugs = {}; // part slug → [english h2 slugs]
for (const p of PARTS) {
  const md = fs.readFileSync(path.join(manualDir, p.file), "utf8");
  enSlugs[fileSlug(p.file)] = h2Texts(md).map(slugify);
}

const partsByLocale = {};
for (const loc of SITE_LOCALES) {
  partsByLocale[loc] = PARTS.map((p) => {
    const slug = fileSlug(p.file);
    const rel = loc === "en" ? p.file : path.join(loc, p.file);
    const pAbs = path.join(manualDir, rel);
    let md;
    if (fs.existsSync(pAbs)) {
      md = fs.readFileSync(pAbs, "utf8");
    } else {
      console.warn(`[guide] missing ${rel} — using the English text for this part`);
      md = fs.readFileSync(path.join(manualDir, p.file), "utf8");
    }
    const h2s = h2Texts(md);
    const enList = enSlugs[slug];
    if (h2s.length !== enList.length) {
      console.warn(`[guide] ${loc}/${p.file}: ${h2s.length} "## " sections vs ${enList.length} in English — anchors may drift`);
    }
    const ids = h2s.map((_, i) => `sec-${slug}-${enList[i] || `h2-${i + 1}`}`);
    const { html, toc } = convert(md, slug, loc, ids);
    return { slug, label: PART_LABELS[loc][slug], g: p.g, html, toc };
  });
}

// ── Structural checks (walkthroughs & diagrams mirror English 1:1) ──
{
  for (const loc of SITE_LOCALES) {
    if (loc === "en") continue;
    if (WALKS[loc].length !== WALKS.en.length) {
      console.warn(`[guide] ${loc}: ${WALKS[loc].length} walkthroughs vs ${WALKS.en.length} in English`);
    }
    WALKS.en.forEach((w, i) => {
      const l = WALKS[loc][i];
      if (!l || l.id !== w.id) console.warn(`[guide] ${loc}: walkthrough #${i + 1} id mismatch (${w.id} vs ${l && l.id})`);
      else if (l.steps.length !== w.steps.length) console.warn(`[guide] ${loc}: walkthrough "${w.id}" has ${l.steps.length} steps vs ${w.steps.length} in English`);
    });
    for (const [partSlug, table] of Object.entries(DIAGRAMS.en)) {
      const lt = DIAGRAMS[loc][partSlug] || {};
      for (const key of Object.keys(table)) {
        if (!lt[key]) console.warn(`[guide] ${loc}: missing diagram ${partSlug} → ${key}`);
      }
    }
  }
}

// ── Styles ──
const CSS = `
:root{
  --bg:#f6f8fb; --panel:#ffffff; --ink:#1e293b; --muted:#64748b; --line:#e6ebf2;
  --brand:#2563eb; --brand-d:#1d4ed8; --teal:#0d9488; --green:#16a34a; --amber:#d97706;
  --red:#dc2626; --soft:#eef4ff; --radius:14px;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans Khmer","PingFang SC","Hiragino Sans","Microsoft YaHei",sans-serif;color:var(--ink);background:var(--bg);-webkit-font-smoothing:antialiased}
html[lang="km"] body{line-height:1.9}
a{color:var(--brand);text-decoration:none}
a:hover{text-decoration:underline}
img{max-width:100%}
#menuBtn{display:none;position:fixed;top:12px;left:12px;z-index:60;width:44px;height:44px;border-radius:10px;border:1px solid var(--line);background:#fff;font-size:20px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,.08)}
#sidebar{position:fixed;top:0;left:0;bottom:0;width:288px;overflow-y:auto;background:var(--panel);border-right:1px solid var(--line);padding:18px 14px 40px;z-index:50}
.brand{display:flex;align-items:center;gap:11px;padding:6px 8px 16px;border-bottom:1px solid var(--line);margin-bottom:12px}
.brand:hover{text-decoration:none}
.brand-badge{width:40px;height:40px;border-radius:11px;background:linear-gradient(135deg,var(--brand),var(--teal));color:#fff;font-weight:800;display:grid;place-items:center;font-size:17px;letter-spacing:.5px}
.brand-name{font-weight:800;font-size:16px;color:var(--ink)}
.brand-sub{font-size:12px;color:var(--muted)}
.lang-wrap{position:relative;margin:0 0 10px}
#langBtn{width:100%;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:9px 12px;font-size:13.5px;font-weight:600;cursor:pointer;color:#334155;font-family:inherit}
#langBtn:hover{border-color:var(--brand)}
.lang-caret{margin-left:auto;font-size:10px;color:var(--muted)}
.lang-menu{position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 24px rgba(15,23,42,.14);z-index:70;overflow:hidden}
.lang-menu button{display:flex;width:100%;align-items:center;gap:8px;background:none;border:0;padding:9px 13px;font-size:13.5px;cursor:pointer;color:#334155;text-align:left;font-family:inherit}
.lang-menu button:hover{background:var(--soft)}
.lang-menu button.current{color:var(--brand-d);font-weight:700}
.lang-menu button.current:after{content:"✓";margin-left:auto;color:var(--brand-d)}
.nav-group{margin:14px 0 4px}
.nav-group-title{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:700;padding:0 10px 6px}
.nav-link{display:block;padding:7px 10px;border-radius:9px;color:#334155;font-size:14px;margin:1px 0}
.nav-link:hover{background:var(--soft);text-decoration:none}
.nav-link.active{background:var(--brand);color:#fff;font-weight:600}
.nav-home,.nav-walk{font-weight:600;margin-bottom:2px}
.side-foot{margin-top:18px;padding:12px 10px;font-size:11.5px;color:var(--muted);border-top:1px solid var(--line)}
main{margin-left:288px;padding:34px 42px 90px;max-width:1080px}
.crumbs{font-size:13px;color:var(--muted);margin-bottom:6px}
.crumbs b{color:var(--brand-d)}
.content h1.part-title{font-size:30px;line-height:1.25;margin:6px 0 18px;padding-bottom:14px;border-bottom:3px solid var(--brand)}
.content h2{font-size:23px;margin:38px 0 14px;padding-top:10px;display:flex;align-items:baseline;gap:10px;scroll-margin-top:20px}
.content h2 .sec-no{flex:0 0 auto;width:28px;height:28px;border-radius:8px;background:var(--soft);color:var(--brand-d);font-size:14px;font-weight:800;display:inline-grid;place-items:center}
.content h3{font-size:18px;margin:26px 0 10px;color:#0f172a}
.content h4{font-size:15px;margin:18px 0 8px;color:#334155}
.content p{margin:12px 0}
.content ul,.content ol{margin:12px 0;padding-left:24px}
.content li{margin:5px 0}
.content hr.soft{border:0;border-top:1px solid var(--line);margin:26px 0}
code{background:#eef2f7;border:1px solid #e2e8f0;border-radius:6px;padding:1.5px 6px;font-size:.88em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:#be185d}
pre.code{background:#0f172a;color:#e2e8f0;border-radius:12px;padding:16px 18px;overflow:auto;font-size:13px;line-height:1.55;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.table-wrap{overflow-x:auto;margin:16px 0;border:1px solid var(--line);border-radius:12px}
table{border-collapse:collapse;width:100%;font-size:14px;background:#fff}
th,td{padding:9px 13px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
th{background:#f1f5f9;font-weight:700;font-size:12.5px;text-transform:uppercase;letter-spacing:.02em;color:#475569;white-space:nowrap}
tr:last-child td{border-bottom:0}
tbody tr:hover{background:#f8fafc}
.note{background:#f0f9ff;border:1px solid #bae6fd;border-left:4px solid var(--brand);border-radius:10px;padding:11px 15px;margin:16px 0;color:#0c4a6e;font-size:14.5px}
.note-warn{background:#fffbeb;border-color:#fde68a;border-left-color:var(--amber);color:#78350f}
.note-danger{background:#fef2f2;border-color:#fecaca;border-left-color:var(--red);color:#7f1d1d}
.note strong{color:inherit}
/* diagrams */
figure.diagram{margin:20px 0;padding:0;background:linear-gradient(180deg,#fbfdff,#f4f8ff);border:1px solid var(--line);border-radius:16px;padding:18px}
figure.diagram figcaption{font-size:13px;font-weight:700;color:var(--brand-d);text-transform:uppercase;letter-spacing:.04em;margin-bottom:14px;display:flex;align-items:center;gap:8px}
figure.diagram figcaption:before{content:"▣";color:var(--teal)}
.flow{display:flex;flex-direction:column;align-items:stretch;gap:0}
.flow-h{flex-direction:row;align-items:stretch;flex-wrap:wrap;justify-content:center}
.flow-node{background:#fff;border:1.5px solid #cbd5e1;border-radius:11px;padding:9px 14px;font-size:13.5px;font-weight:600;color:#1e293b;text-align:center;box-shadow:0 1px 2px rgba(15,23,42,.05)}
.flow-node.v-blue{background:#eff6ff;border-color:#93c5fd;color:#1e40af}
.flow-node.v-green{background:#ecfdf5;border-color:#86efac;color:#166534}
.flow-node.v-amber{background:#fffbeb;border-color:#fcd34d;color:#92400e}
.flow-node.v-teal{background:#f0fdfa;border-color:#5eead4;color:#115e59}
.flow-arrow{text-align:center;color:#94a3b8;font-size:18px;line-height:1;margin:2px 0;font-weight:700}
.flow-arrow-h{margin:0 6px;align-self:center}
.formula{background:#fff;border:1.5px dashed #c7d2fe;border-radius:12px;padding:14px 18px}
.formula-title{font-weight:800;color:var(--brand-d);margin-bottom:10px;font-size:14.5px}
.formula-row{padding:5px 0;font-size:14.5px}
.formula-rule{border-top:2px solid var(--ink);margin:6px 0;width:100%}
/* home */
.hero{background:linear-gradient(135deg,#1e3a8a,#0d9488);border-radius:20px;padding:34px;color:#fff;display:grid;grid-template-columns:1.2fr 1fr;gap:24px;align-items:center;overflow:hidden}
.hero h1{font-size:34px;line-height:1.15;margin:0 0 12px}
.hero p{margin:0 0 18px;color:#dbeafe;font-size:15.5px}
.hero-img{border-radius:14px;background:#fff;padding:8px;box-shadow:0 12px 30px rgba(0,0,0,.25)}
.hero-img img{display:block;border-radius:9px;width:100%}
.btn{display:inline-block;background:#fff;color:var(--brand-d);font-weight:700;padding:11px 20px;border-radius:11px;margin:4px 8px 4px 0;border:none;cursor:pointer;font-size:14.5px}
.btn:hover{text-decoration:none;transform:translateY(-1px)}
.btn.ghost{background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.4)}
.home-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin-top:22px}
.home-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;transition:.15s;cursor:pointer}
.home-card:hover{border-color:var(--brand);box-shadow:0 6px 20px rgba(37,99,235,.12);transform:translateY(-2px)}
.home-card .ico{font-size:24px}
.home-card h3{margin:8px 0 4px;font-size:15.5px}
.home-card p{margin:0;color:var(--muted);font-size:13px}
.section-label{font-size:13px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:700;margin:30px 0 4px}
.feature-row{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:22px}
.feature-box{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;gap:16px;align-items:center}
.feature-box img{width:120px;flex:0 0 120px;border-radius:10px}
.feature-box h3{margin:0 0 6px;font-size:16px}
.feature-box p{margin:0;font-size:13.5px;color:var(--muted)}
/* walks */
.walk-layout{display:grid;grid-template-columns:270px 1fr;gap:24px;align-items:start}
.walk-list{position:sticky;top:20px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px}
.walk-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:0;padding:10px 11px;border-radius:10px;cursor:pointer;font-size:13.5px;color:#334155;font-weight:600;font-family:inherit}
.walk-item:hover{background:var(--soft)}
.walk-item.active{background:var(--brand);color:#fff}
.walk-num{flex:0 0 24px;width:24px;height:24px;border-radius:50%;background:var(--soft);color:var(--brand-d);display:grid;place-items:center;font-size:12.5px;font-weight:800}
.walk-item.active .walk-num{background:rgba(255,255,255,.25);color:#fff}
.walk-panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:26px}
.walk-meta{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 4px}
.chip{font-size:12px;font-weight:700;padding:4px 11px;border-radius:999px;background:var(--soft);color:var(--brand-d)}
.chip.time{background:#f0fdfa;color:var(--teal)}
.walk-intro{color:var(--muted);font-size:14.5px;margin:8px 0 22px}
.steps{counter-reset:s;list-style:none;padding:0;margin:0}
.step{display:flex;gap:16px;padding:16px 0;border-bottom:1px dashed var(--line);opacity:.45;transition:.2s}
.step.done{opacity:.55}
.step.current{opacity:1}
.step.todo{opacity:.45}
.step-badge{flex:0 0 38px;width:38px;height:38px;border-radius:50%;border:2px solid #cbd5e1;display:grid;place-items:center;font-weight:800;color:#94a3b8;background:#fff}
.step.current .step-badge{background:var(--brand);border-color:var(--brand);color:#fff;box-shadow:0 0 0 5px #dbeafe}
.step.done .step-badge{background:var(--green);border-color:var(--green);color:#fff}
.step-body h4{margin:2px 0 6px;font-size:16px}
.step-body p{margin:0;font-size:14.5px}
.step-menu{display:inline-block;margin-top:8px;font-size:12px;background:#f8fafc;border:1px solid var(--line);border-radius:7px;padding:3px 9px;color:#475569}
.step-menu:before{content:"🧭 ";}
.shot-wrap{position:relative;margin-top:10px;border:1px solid var(--line);border-radius:11px;overflow:hidden;background:#eef2f7;box-shadow:0 2px 10px rgba(15,23,42,.08)}
.shot{display:block;width:100%;max-height:360px;object-fit:cover;object-position:top center}
.shot-cap{position:absolute;top:8px;left:8px;background:rgba(15,23,42,.72);color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px}
.step.todo .shot-wrap{display:none}
.walk-controls{display:flex;justify-content:space-between;margin-top:22px;gap:10px}
.wbtn{border:1px solid var(--line);background:#fff;border-radius:10px;padding:10px 18px;font-weight:700;cursor:pointer;color:#334155;font-size:14px;font-family:inherit}
.wbtn.primary{background:var(--brand);color:#fff;border-color:var(--brand)}
.wbtn:disabled{opacity:.4;cursor:not-allowed}
.progress{height:8px;background:#eef2f7;border-radius:99px;overflow:hidden;margin:6px 0 20px}
.progress > div{height:100%;background:linear-gradient(90deg,var(--brand),var(--teal));width:0;transition:.3s}
.walk-done{background:#ecfdf5;border:1px solid #86efac;color:#166534;border-radius:12px;padding:14px 18px;font-weight:600;margin-top:18px;display:none}
.walk-done.show{display:block}
.subtoc{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin:0 0 22px;font-size:13.5px}
.subtoc b{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.subtoc a{display:inline-block;margin:4px 12px 4px 0;color:var(--brand-d)}
@media(max-width:900px){
  #sidebar{transform:translateX(-100%);transition:.2s;box-shadow:0 0 40px rgba(0,0,0,.2)}
  #sidebar.open{transform:translateX(0)}
  main{margin-left:0;padding:64px 18px 70px}
  #menuBtn{display:block}
  .hero{grid-template-columns:1fr}
  .feature-row,.walk-layout{grid-template-columns:1fr}
  .walk-list{position:static}
}
@media print{
  #sidebar,#menuBtn{display:none}
  main{margin:0;max-width:100%;padding:0}
  .home-card,.walk-list,.walk-controls,.progress{display:none}
  figure.diagram,.note,.table-wrap{break-inside:avoid}
}
`;

// ── Client app (locale-aware) ──
const APP_JS = `
const $ = (s, r = document) => r.querySelector(s);
const main = $('#main');

// Locale resolution mirrors the app: the rm-locale cookie (set by the app's
// 🌐 LanguageSwitcher and shared with it) wins, then this guide's own
// localStorage choice (covers standalone/file:// use), then English.
function readCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function initLocale() {
  const c = readCookie('rm-locale');
  if (c && LOCALES.includes(c)) return c;
  try {
    const s = localStorage.getItem('rm-guide-locale');
    if (s && LOCALES.includes(s)) return s;
  } catch (e) {}
  return 'en';
}
let locale = initLocale();

function applyLocale(next) {
  if (!LOCALES.includes(next) || next === locale) return;
  locale = next;
  try { localStorage.setItem('rm-guide-locale', next); } catch (e) {}
  document.cookie = 'rm-locale=' + next + '; path=/; max-age=31536000; samesite=lax';
  document.documentElement.lang = META[locale].htmlLang;
  document.title = UI[locale].title;
  renderLang();
  renderSidebar();
  route();
}

function renderLang() {
  $('#langCur').textContent = META[locale].native;
  document.querySelectorAll('#langMenu button').forEach(b => {
    b.classList.toggle('current', b.dataset.loc === locale);
  });
}

function renderSidebar() {
  const u = UI[locale];
  const groups = GROUPS[locale];
  $('#brandSub').textContent = u.brandSub;
  let html = '';
  html += '<a class="nav-link nav-home" data-route="home" href="#/home">' + u.side.home + '</a>';
  html += '<a class="nav-link nav-walk" data-route="walks" href="#/walks">' + u.side.walks + '</a>';
  for (let gi = 0; gi < groups.length; gi++) {
    html += '<div class="nav-group"><div class="nav-group-title">' + groups[gi] + '</div>';
    for (const p of PARTS[locale]) {
      if (p.g === gi) html += '<a class="nav-link" data-route="part/' + p.slug + '" href="#/part/' + p.slug + '">' + p.label + '</a>';
    }
    html += '</div>';
  }
  $('#sideNav').innerHTML = html;
  $('.side-foot').textContent = u.side.foot.replace('{n}', PARTS[locale].length);
}

function route() {
  const hash = location.hash || '#/home';
  const h = hash.replace(/^#\\\//, '');
  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.route && h.startsWith(a.dataset.route));
  });
  $('#sidebar').classList.remove('open');
  if (h === 'home') return renderHome();
  if (h === 'walks' || h.startsWith('walk/')) return renderWalks(h);
  if (h.startsWith('part/')) {
    const pp = h.split('#');
    const slug = pp[0].split('/')[1];
    return renderPart(slug, pp[1] || null);
  }
  renderHome();
}

function renderHome() {
  const u = UI[locale];
  const groups = GROUPS[locale];
  let cards = '';
  for (let gi = 0; gi < groups.length; gi++) {
    cards += '<div class="section-label">' + groups[gi] + '</div><div class="home-grid">';
    for (const p of PARTS[locale]) {
      if (p.g === gi) cards += '<a class="home-card" href="#/part/' + p.slug + '"><div class="ico">📘</div><h3>' + p.label + '</h3><p>' + u.home.sections.replace('{n}', p.toc.length) + '</p></a>';
    }
    cards += '</div>';
  }
  main.innerHTML =
   '<div class="hero"><div><h1>' + u.home.heroTitle + '</h1>' +
   '<p>' + u.home.heroSub + '</p>' +
   '<a class="btn" href="#/walks">' + u.home.btnWalks + '</a>' +
   '<a class="btn ghost" href="#/part/02-quick-start">' + u.home.btnQuick + '</a></div>' +
   '<div class="hero-img"><img src="' + IMG.hero + '" alt="RentManager illustration"/></div></div>' +
   '<div class="feature-row">' +
   '<div class="feature-box"><img src="' + IMG.tenant + '" alt="Tenant"/><div><h3>' + u.home.featStaffTitle + '</h3><p>' + u.home.featStaffText + '</p><a href="#/part/03-user-guide">' + u.home.featStaffLink + '</a></div></div>' +
   '<div class="feature-box"><img src="' + IMG.admin + '" alt="Admin"/><div><h3>' + u.home.featAdminTitle + '</h3><p>' + u.home.featAdminText + '</p><a href="#/part/08-administrator-guide">' + u.home.featAdminLink + '</a></div></div>' +
   '</div>' + cards;
  window.scrollTo(0, 0);
}

function renderPart(slug, sec) {
  const u = UI[locale];
  const p = PARTS[locale].find(x => x.slug === slug);
  if (!p) { main.innerHTML = '<p>' + u.part.notFound + '</p>'; return; }
  const groups = GROUPS[locale];
  const toc = p.toc.map(t => '<a href="#/part/' + p.slug + '#sec-' + p.slug + '-' + t.anchor + '">' + t.n + '. ' + t.text + '</a>').join('');
  main.innerHTML =
    '<div class="crumbs">' + u.part.crumb + ' · <b>' + groups[p.g] + '</b> · ' + p.label + '</div>' +
    '<div class="content">' + p.html + '</div>';
  if (p.toc.length) {
    const bar = document.createElement('div');
    bar.className = 'subtoc';
    bar.innerHTML = '<b>' + u.part.onThisPage + '</b><br>' + toc;
    $('.content', main).insertBefore(bar, $('.content', main).firstChild);
  }
  window.scrollTo(0, 0);
  if (sec) {
    const el = document.getElementById(sec);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
}

function renderWalks(h) {
  const u = UI[locale];
  const list = WALKS[locale];
  const id = h.startsWith('walk/') ? h.split('/')[1] : list[0].id;
  const w = list.find(x => x.id === id) || list[0];
  const idx = list.findIndex(x => x.id === w.id);
  const nav = list.map((x, i) => '<button class="walk-item" data-walk="' + x.id + '"><span class="walk-num">' + (i + 1) + '</span><span>' + x.title + '</span></button>').join('');
  main.innerHTML =
    '<div class="crumbs">' + u.part.crumb + ' · <b>' + u.walks.crumb + '</b></div>' +
    '<h1 style="margin:6px 0 18px;font-size:28px">' + u.walks.title + '</h1>' +
    '<div class="walk-layout"><div class="walk-list">' + nav + '</div>' +
    '<div class="walk-panel" id="walkPanel"></div></div>';
  document.querySelectorAll('.walk-item').forEach(b => b.addEventListener('click', () => {
    drawWalk(list.findIndex(x => x.id === b.dataset.walk), 0);
  }));
  drawWalk(idx, 0);
  window.scrollTo(0, 0);
}

function drawWalk(idx, step) {
  const u = UI[locale];
  const list = WALKS[locale];
  const w = list[idx];
  document.querySelectorAll('.walk-item').forEach((b, i) => b.classList.toggle('active', i === idx));
  const total = w.steps.length;
  const pct = Math.round((step / total) * 100);
  let stepsHtml = w.steps.map((s, i) => {
    const cls = i < step ? 'done' : i === step ? 'current' : 'todo';
    const badge = i < step ? '✓' : (i + 1);
    return '<li class="step ' + cls + '"><div class="step-badge">' + badge + '</div><div class="step-body">' +
      '<h4>' + s.t + '</h4><p>' + md(s.d) + '</p>' +
      (s.shot ? '<div class="shot-wrap"><img class="shot" loading="lazy" src="img/' + s.shot + '" alt="' + s.t + '" /><span class="shot-cap">' + u.walks.shotCap + '</span></div>' : '') +
      (s.menu ? '<span class="step-menu">' + s.menu + '</span>' : '') + '</div></li>';
  }).join('');
  const panel = $('#walkPanel');
  panel.innerHTML =
    '<h2 style="margin:0;font-size:22px">' + w.title + '</h2>' +
    '<div class="walk-meta"><span class="chip">👤 ' + w.role + '</span><span class="chip time">⏱ ' + w.time + '</span></div>' +
    '<p class="walk-intro">' + w.intro + '</p>' +
    '<div class="progress"><div style="width:' + pct + '%"></div></div>' +
    '<ol class="steps">' + stepsHtml + '</ol>' +
    '<div class="walk-done' + (step >= total ? ' show' : '') + '">' + u.walks.done + '</div>' +
    '<div class="walk-controls">' +
      '<div><button class="wbtn" id="prevBtn" ' + (step <= 0 ? 'disabled' : '') + '>' + u.walks.prev + '</button> ' +
      '<button class="wbtn" id="restartBtn">' + u.walks.restart + '</button></div>' +
      '<button class="wbtn primary" id="nextBtn" ' + (step >= total ? 'disabled' : '') + '>' + (step >= total - 1 ? u.walks.finish : u.walks.next) + '</button>' +
    '</div>';
  $('#prevBtn').onclick = () => drawWalk(idx, Math.max(0, step - 1));
  $('#nextBtn').onclick = () => drawWalk(idx, Math.min(total, step + 1));
  $('#restartBtn').onclick = () => drawWalk(idx, 0);
}

// minimal inline markdown for walkthrough descriptions (**bold**, \`code\`)
function md(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\x60([^\\x60]+)\\x60/g, '<code>$1</code>');
}

window.addEventListener('hashchange', route);
$('#menuBtn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#langBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  const menu = $('#langMenu');
  menu.hidden = !menu.hidden;
});
document.querySelectorAll('#langMenu button').forEach(b => {
  b.addEventListener('click', () => { $('#langMenu').hidden = true; applyLocale(b.dataset.loc); });
});
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.lang-wrap');
  if (wrap && !wrap.contains(e.target)) $('#langMenu').hidden = true;
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#langMenu').hidden = true; });

document.documentElement.lang = META[locale].htmlLang;
document.title = UI[locale].title;
renderLang();
renderSidebar();
route();
`;

// ── Assemble the page ──
const html = `<!doctype html>
<html lang="${SITE_LOCALE_META.en.htmlLang}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${UI.en.title}</title>
<style>${CSS}</style>
</head>
<body>
<button id="menuBtn" aria-label="Menu">☰</button>
<aside id="sidebar">
  <a class="brand" href="#/home">
    <div class="brand-badge">RM</div>
    <div><div class="brand-name">RentManager</div><div class="brand-sub" id="brandSub">${UI.en.brandSub}</div></div>
  </a>
  <div class="lang-wrap">
    <button id="langBtn" type="button" aria-haspopup="listbox" aria-label="Language">🌐 <span id="langCur">${SITE_LOCALE_META.en.native}</span><span class="lang-caret">▾</span></button>
    <div id="langMenu" class="lang-menu" hidden>
      ${SITE_LOCALES.map((l) => `<button type="button" data-loc="${l}">${SITE_LOCALE_META[l].native}</button>`).join("\n      ")}
    </div>
  </div>
  <nav id="sideNav"></nav>
  <div class="side-foot"></div>
</aside>
<main id="main"></main>

<script>
const LOCALES = ${JSON.stringify(SITE_LOCALES)};
const META = ${JSON.stringify(SITE_LOCALE_META)};
const GROUPS = ${JSON.stringify(GROUP_NAMES)};
const UI = ${JSON.stringify(UI)};
const PARTS = ${JSON.stringify(partsByLocale)};
const WALKS = ${JSON.stringify(WALKS)};
const IMG = { hero: "${img.hero}", tenant: "${img.tenant}", admin: "${img.admin}" };
${APP_JS}
</script>
</body>
</html>`;

fs.writeFileSync(path.join(here, "index.html"), html);

// Also publish into the Next.js public/ folder so the guide is served in-app
// at /guide (see src/app/guide/page.tsx) and opens from the sidebar.
const publicGuide = path.resolve(here, "../../../public/guide");
fs.rmSync(publicGuide, { recursive: true, force: true });
fs.mkdirSync(publicGuide, { recursive: true });
fs.writeFileSync(path.join(publicGuide, "index.html"), html);
fs.cpSync(path.join(here, "img"), path.join(publicGuide, "img"), { recursive: true });

console.log(`Built docs/manual/site/index.html — ${PARTS.length} parts × ${SITE_LOCALES.length} languages (${SITE_LOCALES.join(" / ")}), ${WALKS.en.length} walkthroughs per language`);
console.log("Published to public/guide/ (in-app at /guide)");
