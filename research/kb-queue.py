"""Queue operations for the kb-nightly skill, so the model never hand-edits TSV.

research/coaching-transcripts/queue.tsv columns:
    id  channel  views  duration  status  score  title

Usage (always by absolute path; the nightly allowlist matches that):
    kb-queue.py merge HANDLE        add ids from listings/HANDLE.tsv as status 'new'
    kb-queue.py list STATUS [N]     rows with STATUS ('retry' matches retry:*)
    kb-queue.py top [N]             best candidates: scored/retry rows by score, then views
    kb-queue.py set ID STATUS       e.g. doing | done | retry:1 | skip:filter <reason>
    kb-queue.py score ID N          set score 0-5 (and status 'scored' if it was 'new')
    kb-queue.py stats               counts per status
"""

import os
import sys
from pathlib import Path

KB = Path(__file__).resolve().parent / "coaching-transcripts"
QUEUE = KB / "queue.tsv"
COLS = 7


def clean(field: str) -> str:
    return " ".join(str(field).replace("\t", " ").split())


def load() -> list[list[str]]:
    if not QUEUE.exists():
        return []
    rows = []
    for n, line in enumerate(QUEUE.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        f = line.split("\t")
        if len(f) != COLS:
            sys.exit(f"queue.tsv line {n} has {len(f)} fields, expected {COLS}: {line[:80]}")
        rows.append(f)
    return rows


def save(rows: list[list[str]]) -> None:
    tmp = QUEUE.with_suffix(".tsv.tmp")
    tmp.write_text("".join("\t".join(clean(x) for x in r) + "\n" for r in rows), encoding="utf-8")
    os.replace(tmp, QUEUE)


def find(rows: list[list[str]], vid: str) -> list[str]:
    for r in rows:
        if r[0] == vid:
            return r
    sys.exit(f"no queue row for id {vid}")


def show(r: list[str]) -> str:
    vid, ch, views, dur, status, score, title = r
    return f"{vid}\t{ch}\tviews={views}\tdur={dur}s\t{status}\tscore={score}\t{title}"


def num(x: str) -> float:
    try:
        return float(x)
    except ValueError:
        return 0.0


def candidates(rows: list[list[str]]) -> list[list[str]]:
    c = [r for r in rows if r[4] == "scored" or r[4].startswith("retry:")]
    return sorted(c, key=lambda r: (-num(r[5]), -num(r[2])))


def main(argv: list[str]) -> None:
    if not argv:
        sys.exit(__doc__)
    cmd, args = argv[0], argv[1:]
    rows = load()

    if cmd == "merge" and len(args) == 1:
        listing = KB / "listings" / f"{args[0]}.tsv"
        known = {r[0] for r in rows}
        added = 0
        for line in listing.read_text(encoding="utf-8").splitlines():
            f = line.split("\t")
            if len(f) < 4 or f[0] in known:
                continue
            vid, views, dur, title = f[0], f[1], f[2], "\t".join(f[3:])
            rows.append([vid, args[0], views, dur, "new", "0", title])
            known.add(vid)
            added += 1
        save(rows)
        print(f"merged {added} new ids from {args[0]}")
    elif cmd == "list" and args:
        want, limit = args[0], int(args[1]) if len(args) > 1 else 50
        hits = [r for r in rows if r[4] == want or (want == "retry" and r[4].startswith("retry:"))]
        for r in hits[:limit]:
            print(show(r))
        print(f"({len(hits)} rows with status {want})")
    elif cmd == "top":
        for r in candidates(rows)[: int(args[0]) if args else 30]:
            print(show(r))
    elif cmd == "set" and len(args) >= 2:
        r = find(rows, args[0])
        r[4] = " ".join(args[1:])
        save(rows)
        print(show(r))
    elif cmd == "score" and len(args) == 2:
        r = find(rows, args[0])
        s = int(args[1])
        if not 0 <= s <= 5:
            sys.exit("score must be 0-5")
        r[5] = str(s)
        if r[4] == "new":
            r[4] = "scored"
        save(rows)
        print(show(r))
    elif cmd == "stats":
        counts: dict[str, int] = {}
        for r in rows:
            k = r[4].split(":")[0] if ":" in r[4] else r[4]
            counts[k] = counts.get(k, 0) + 1
        print("  ".join(f"{k}={v}" for k, v in sorted(counts.items())), f"total={len(rows)}")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
