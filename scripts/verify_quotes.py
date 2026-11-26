"""Verify every quote in the distilled criteria against the original transcripts, then merge.

Usage: python3 -I verify_quotes.py <repo_dir> <criteria_dir> <out_json>

A source survives only if its quote is an exact (whitespace-normalised) substring of the
turn spoken by that speaker at that timestamp in that episode. Criteria left with no
verified source are dropped. Adds a clip link that starts at the moment of the quote.
"""
import json, re, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from extract_passages import parse  # noqa: E402

HOST = "Aakash"

# Speaker labels in the source repo that aren't a person's name.
# Rename only where the episode itself names the single guest; otherwise drop the source.
SPEAKER_FIX = {
    ("2026-08-06-oji-udezue-claude-skills.md", "Guest"): "Oji Udezue",  # title: "3x CPO Oji Udezue on..."
}
SPEAKER_DROP = {
    ("2025-12-08-chatgpt-codex-guide.md", "OpenAI's Claude Code"),  # guest name absent from the transcript
}


def norm(s):
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", s).strip()


def main(repo, cdir, out):
    repo = Path(repo)
    cache = {}
    merged, report = [], {"criteria_in": 0, "criteria_out": 0, "sources_in": 0, "sources_ok": 0, "rejected": []}
    for f in sorted(Path(cdir).glob("*.json")):
        for c in json.loads(f.read_text(encoding="utf-8")):
            report["criteria_in"] += 1
            ok = []
            for s in c.get("sources", []):
                report["sources_in"] += 1
                ep = repo / "episodes" / s["file"]
                if s["file"] not in cache:
                    cache[s["file"]] = parse(ep)[1] if ep.exists() else []
                turns = cache[s["file"]]
                hit = next((t for t in turns if t["ts"] == s["ts"] and t["speaker"] == s["speaker"]), None)
                q = norm(s.get("quote", ""))
                words = len(q.split())
                key = (s["file"], s["speaker"])
                if key in SPEAKER_DROP:
                    report["rejected"].append({"id": c["id"], "speaker": s["speaker"], "file": s["file"], "quote": "unnamed speaker"})
                    continue
                if hit and HOST not in hit["speaker"] and q and q in norm(" ".join(hit["paras"])) and 5 <= words <= 45:
                    s["clip"] = f'{s["youtube_url"]}&t={hit["seconds"]}s'
                    s["speaker"] = SPEAKER_FIX.get(key, s["speaker"])
                    ok.append(s)
                else:
                    report["rejected"].append({"id": c["id"], "speaker": s.get("speaker"), "file": s.get("file"),
                                               "quote": s.get("quote", "")[:80]})
            report["sources_ok"] += len(ok)
            if ok:
                c["sources"] = ok
                c["era"] = min(s["date"][:4] for s in ok)
                c["guests"] = sorted({s["speaker"] for s in ok})
                merged.append(c)
    report["criteria_out"] = len(merged)
    Path(out).write_text(json.dumps(merged, indent=1, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "rejected"}))
    for r in report["rejected"]:
        print("REJECTED", r)


if __name__ == "__main__":
    main(*sys.argv[1:4])
