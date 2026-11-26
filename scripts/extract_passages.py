"""Pull candidate 'quality bar' passages from the Growth Podcast transcripts.

Usage: python3 -I extract_passages.py <repo_dir> <out_dir>

For each artifact type, keeps guest turns (not the host, not sponsor reads) that mention
the artifact AND use evaluative language (good/bad/mistake/should/look for/slop...).
Writes one JSONL file per artifact type for the distillation step.
"""
import json, re, sys, csv
from pathlib import Path

ARTIFACTS = {
    "prd": r"\bPRDs?\b|product requirement|spec doc|\bspecs?\b|one[- ]pager|requirements doc",
    "prototype": r"prototyp|vibe[- ]cod|lovable|\bv0\b|\bbolt\b|magic patterns|figma make|mockup",
    "eval_plan": r"\bevals?\b|evaluation|golden (data)?set|LLM[- ]as[- ]a[- ]judge|\btraces?\b|error analysis",
}
EVALUATIVE = re.compile(
    r"\b(good|great|bad|best|worst|mistake|wrong|should|shouldn't|must|never|always|"
    r"look for|red flag|slop|generic|quality|the bar|bar is|tip|secret|key is|"
    r"most (people|PMs)|common|failure|fail|avoid|instead)\b",
    re.I,
)
TURN = re.compile(r"^\*\*(.+?)\*\* \((\d\d):(\d\d):(\d\d)\)\s*$")


def parse(path):
    text = path.read_text(encoding="utf-8")
    fm = {}
    m = re.match(r"^---\n(.*?)\n---\n", text, re.S)
    if m:
        for line in m.group(1).splitlines():
            k, _, v = line.partition(":")
            if v.strip():
                fm[k.strip()] = v.strip().strip('"')
    turns, cur = [], None
    skip_next = False
    for line in text.splitlines():
        t = TURN.match(line)
        if t:
            if cur:
                turns.append(cur)
            h, mi, s = map(int, t.groups()[1:])
            cur = {"speaker": t.group(1), "seconds": h * 3600 + mi * 60 + s, "ts": f"{h:02d}:{mi:02d}:{s:02d}", "paras": []}
            continue
        if line.strip() == "<!-- sponsor -->":
            skip_next = True
            continue
        if cur is not None and line.strip():
            if skip_next:
                skip_next = False
                continue
            cur["paras"].append(line.strip())
    if cur:
        turns.append(cur)
    return fm, turns


def main(repo, out):
    repo, out = Path(repo), Path(out)
    out.mkdir(parents=True, exist_ok=True)
    rows = {r["file"]: r for r in csv.DictReader(open(repo / "index.csv", encoding="utf-8"))}
    buckets = {k: [] for k in ARTIFACTS}
    for f in sorted((repo / "episodes").glob("*.md")):
        fm, turns = parse(f)
        row = rows.get(f"episodes/{f.name}", {})
        host = fm.get("host", "Aakash Gupta")
        for t in turns:
            if t["speaker"] == host or "Aakash" in t["speaker"]:
                continue
            body = " ".join(t["paras"])
            if len(body) < 200 or not EVALUATIVE.search(body):
                continue
            for kind, pat in ARTIFACTS.items():
                if len(re.findall(pat, body, re.I)) >= 2:
                    buckets[kind].append({
                        "file": f.name,
                        "date": fm.get("date"),
                        "title": fm.get("title", "")[:140],
                        "speaker": t["speaker"],
                        "ts": t["ts"],
                        "seconds": t["seconds"],
                        "youtube_url": row.get("youtube_url") or fm.get("youtube_url"),
                        "text": body[:2200],
                    })
    for kind, items in buckets.items():
        with open(out / f"{kind}.jsonl", "w", encoding="utf-8") as fh:
            for it in items:
                fh.write(json.dumps(it, ensure_ascii=False) + "\n")
        print(kind, len(items), "passages from", len({i["file"] for i in items}), "episodes")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
