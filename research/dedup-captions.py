import re, pathlib

def collapse(tokens, maxk=12):
    """Collapse immediately-repeated k-gram runs (k=maxk..1), exact match,
    punctuation/number safe. Iterates to stability."""
    changed = True
    while changed:
        changed = False
        out, i, n = [], 0, len(tokens)
        while i < n:
            hit = False
            for k in range(min(maxk, (n - i) // 2), 0, -1):
                if tokens[i:i+k] == tokens[i+k:i+2*k]:
                    j = i + k
                    while tokens[j:j+k] == tokens[i:i+k]:
                        j += k
                    out.extend(tokens[i:i+k]); i = j; hit = True; changed = True
                    break
            if not hit:
                out.append(tokens[i]); i += 1
        tokens = out
    return tokens

def dedup(text):
    return " ".join(collapse(text.split()))

for raw in sorted(pathlib.Path("raw").glob("*.txt")):
    lines = raw.read_text(encoding="utf-8").splitlines()
    out, in_body, prev_tail = [], False, []
    for ln in lines:
        if ln.strip() == "## Transcript":
            in_body = True; out.append(ln); continue
        if in_body and ln.strip():
            m = re.match(r"(\[\d+:\d+(?::\d+)?\]\s*)(.*)", ln)
            pre, body = (m.group(1), m.group(2)) if m else ("", ln)
            words = collapse(body.split())
            # drop a leading run that just repeats the previous block's tail
            for k in range(min(12, len(words), len(prev_tail)), 0, -1):
                if words[:k] == prev_tail[-k:]:
                    words = words[k:]; break
            prev_tail = (prev_tail + words)[-12:]
            ln = pre + " ".join(words)
        out.append(ln)
    clean = pathlib.Path("clean") / (raw.stem + ".md")
    clean.write_text("\n".join(out) + "\n", encoding="utf-8")
    rw, cw = len(raw.read_text().split()), len(clean.read_text().split())
    print(f"{raw.stem:14} raw={rw:6}  clean={cw:6}  kept={cw*100//rw}%")
