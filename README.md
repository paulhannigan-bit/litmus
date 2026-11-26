# Litmus

**Know if your AI-assisted PM work is good enough before anyone else reads it.**

**▶ Try it live: [litmuspm.com](https://litmuspm.com)** (no sign-up, 3 free tests a day)

AI makes drafting fast, and it makes generic, unconvincing drafts just as fast. Litmus tests a PRD, prototype or
AI-feature eval plan against 60 standards set by 52 product leaders. It tells you whether the draft passes and which
three fixes matter most. Each fix links to a clip of the expert who set the standard.

## How it works

1. **Paste.** A PRD or spec, an eval plan, or a prototype described by its screens or build prompt. Litmus works out
   which one it is.
2. **Test.** The draft is checked against the 20 standards for that document type, including the ones that catch
   typical AI-written drafts.
3. **Fix.** You get:
   - a score against a 75% pass mark
   - an AI slop check
   - your top three fixes, written for this draft
   - what the experts say about each fix, with a clip
   - newer standards you're missing
   - three questions a sharp reviewer will ask

## Use it

**In Claude Code.** Copy `.claude/skills/litmus/` into your project (or `~/.claude/skills/`), then:

```
/litmus test docs/meeting-assistant-prd.md
```

**In the browser.** Open the web version, paste a draft and press *Test this draft*. It opens on an example result for
`examples/sample-prd.md`, a typical AI-written PRD (3 / 20, "Not yet").

## Where the standards come from

The standards are distilled from interview transcripts with product leaders
([growth-podcast-transcripts](https://github.com/aakashg/growth-podcast-transcripts), credited as that repo's license
requires).

1. `scripts/extract_passages.py` keeps expert turns (not the interviewer, not sponsor reads) that talk about the
   document type in evaluative terms.
2. Each set was distilled into 20 standards. Each standard has a check, a `slop_signal` flag, the year it first came up,
   and 1 to 4 expert quotes.
3. `scripts/verify_quotes.py` checks every quote word for word against what that expert said at that timestamp, and
   drops anything that doesn't match. 177 of 180 passed. The 3 dropped quotes came from an episode where the
   transcripts don't name the speaker.

```bash
python3 -I scripts/extract_passages.py <path-to-transcripts-repo> build/passages
# distill build/passages/*.jsonl into build/criteria/*.json (one LLM pass per document type)
python3 -I scripts/verify_quotes.py <path-to-transcripts-repo> build/criteria build/criteria.verified.json
```

## Rules it follows

Experts are credited as the source of a standard, never as reviewers. Litmus never imitates an expert's voice or
implies an endorsement. Check the clip before republishing a quote.
