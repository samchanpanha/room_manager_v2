import io, re, json, glob

# Wrap the multi-line prose blocks (empty-state sentences, module notes) with
# <Tx> now that ui-prose.ts carries their translations. One-off helper.
targets = json.load(io.open("/tmp/prose.json", encoding="utf-8"))
pat = re.compile(r"<([A-Za-z][\w.]*)((?:[^<>\"]|\"[^\"]*\")*)>([^<>]*?\n[^<>]*?)</\1>", re.S)

changed = {}
for f, line, tag, _ in targets:
    if "contract-pdf" in f:
        continue
    s = io.open(f, encoding="utf-8").read()
    if f not in changed:
        changed[f] = [s, 0]
    s = changed[f][0]
    out, last, n = [], 0, 0
    for m in pat.finditer(s):
        if s[: m.start()].count("\n") + 1 != line:
            continue
        inner = m.group(3)
        if "<Tx>" in inner:
            continue
        repl = "<%s%s><Tx>%s</Tx></%s>" % (m.group(1), m.group(2), inner, m.group(1))
        out.append(s[last:m.start()])
        out.append(repl)
        last = m.end()
        n += 1
    if n:
        out.append(s[last:])
        new = "".join(out)
        if 'from "@/components/i18n-text"' in new:
            def merge(mm):
                names = {x.strip() for x in mm.group(1).split(",") if x.strip()}
                names.add("Tx")
                return 'import { %s } from "@/components/i18n-text";' % ", ".join(sorted(names))
            new = re.sub(r'import \{([^}]*)\} from "@/components/i18n-text";', merge, new, count=1)
        else:
            imports = list(re.finditer(r"^import .+?;\n", new, re.M))
            pos = imports[-1].end()
            new = new[:pos] + 'import { Tx } from "@/components/i18n-text";\n' + new[pos:]
        changed[f] = [new, changed[f][1] + n]

for f, (s, n) in changed.items():
    io.open(f, "w", encoding="utf-8").write(s)
    print("%3d  %s" % (n, f))
print("files:", len(changed), "wraps:", sum(n for _, n in changed.values()))
