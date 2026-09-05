import io, re, glob, json

# Find multi-line JSX text nodes (prose) and report which are missing from the
# phrase table. One-off audit helper.
keys = set()
for f in glob.glob("src/lib/locales/ui-*.ts"):
    src = io.open(f, encoding="utf-8").read()
    for m in re.finditer(r'^\s{4}"((?:[^"\\]|\\.)*)":', src, re.M):
        keys.add(m.group(1).replace('\\"', '"'))

def norm(s):
    s = re.sub(r"&(?:apos|#39);", "'", s)
    s = re.sub(r"&quot;", '"', s)
    s = re.sub(r"&amp;", "&", s)
    s = re.sub(r"&gt;", ">", s)
    s = re.sub(r"&lt;", "<", s)
    s = re.sub(r"[\u2018\u2019]", "'", s)
    s = re.sub(r"[\u201c\u201d]", '"', s)
    s = re.sub(r"[\u2013\u2014]", "-", s)
    s = re.sub(r"_", " ", s)
    return re.sub(r"\s+", " ", s).strip()

nkeys = {norm(k).lower() for k in keys}
AUTO = {"TableHead", "Button", "Badge", "CardTitle", "CardDescription", "EmptyState",
        "Label", "Dialog", "StatCard", "PageHeader", "Textarea", "Input", "option", "Tx"}
pat = re.compile(r"<([A-Za-z][\w.]*)((?:[^<>\"]|\"[^\"]*\")*)>([^<>]*?\n[^<>]*?)</\1>", re.S)

found = []
for f in sorted(glob.glob("src/**/*.tsx", recursive=True)):
    if "components/ui/" in f:
        continue
    s = io.open(f, encoding="utf-8").read()
    for m in pat.finditer(s):
        tag, inner = m.group(1), m.group(3)
        if tag in AUTO or "{" in inner:
            continue
        text = norm(inner)
        if len(text.split()) < 5:
            continue
        if text.lower() in nkeys:
            continue
        line = s[: m.start()].count("\n") + 1
        found.append((f, line, tag, text))

print(len(found), "uncovered prose blocks")
json.dump(found, io.open("/tmp/prose.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for f, line, tag, text in found:
    print("%s:%s <%s> %s" % (f, line, tag, text[:110]))
