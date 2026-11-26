---
name: litmus
description: Test a PM's AI-assisted PRD, prototype or AI-feature eval plan against 60 standards set by product leaders, before it goes to stakeholders. Gives a verdict (passes, borderline or not yet), an AI slop check and the top fixes, each backed by the expert who set the standard with a link to the clip. Use on "/litmus", "litmus test this", "review my PRD/prototype/eval plan", "is this slop", "is this ready to send".
---

# Litmus

Litmus tells a PM whether a draft is good enough to send, and what to fix first. The standards live in
`criteria.json` next to this file. Each one was distilled from interviews with product leaders, and every expert
quote in it was checked word for word against its source. Judge only against those standards. Never add your own and
present them as the experts'.

## 1. Get the draft

- A file path: read it. A URL to a prototype: ask for screenshots or the build prompt, since you can't click through it.
- Pasted text: use it as-is.
- If there's no draft, ask for one in a single line.

## 2. Pick the document type

Exactly one of:
- `prd`: PRD, spec, one-pager, requirements doc.
- `prototype`: a prototype, judged from screenshots, a description, or the prompt/plan used to build it.
- `eval_plan`: how an AI feature will be evaluated (test data, judges, error analysis, thresholds).

Say which you picked in one line. If the draft is something else (strategy memo, launch plan), say Litmus covers
only these three types for now, and stop.

## 3. Load the standards

```bash
python3 -c "import json,sys; c=[x for x in json.load(open(sys.argv[1])) if x['artifact']==sys.argv[2]]; print(json.dumps(c,indent=1))" .claude/skills/litmus/criteria.json prd
```

(Swap `prd` for the type. Adjust the path if the skill lives elsewhere.)

## 4. Test each standard

For every standard, decide one of:
- **Meets**: the draft clearly does it. Point to the line.
- **Partly**: it's gestured at but thin, vague, or generic.
- **Misses**: absent, or the draft does the `avoid` thing.
- **N/A**: genuinely doesn't apply to this draft (use sparingly, say why).

Use the standard's `check` field as the test. Quote the draft's own words as evidence, short. Be strict: a reviewer who
passes everything is useless. Generic filler (every section present but nothing specific to this product, user or
company) counts as Partly at best.

Score: Meets = 1, Partly = 0.5, N/A excluded. The pass mark is 75% of the standards judged. The verdict is:
- **Not yet** if any `slop_signal` standard is Misses, whatever the score.
- **Borderline** if the score is within 1 point of the pass mark (e.g. 14 to 16 out of 20). One standard moving
  between Partly and Meets shifts the score by half a point, so a rerun could land either side. Say so, and name
  the standards that would settle it.
- **Passes** if the score is more than 1 point above the pass mark, otherwise **Not yet**.

## 5. Report in this shape

**Verdict.** One line: `Passes`, `Borderline` or `Not yet`, the score (e.g. 9.5 / 14), and the single biggest reason.

**AI slop check.** Every `slop_signal` standard, with its verdict. If any is Misses, lead the fixes with it.

**Fix these first.** The 3 highest-impact Misses/Partly items. For each:
- What's wrong, pointing at the draft's own words.
- The concrete fix, written for this draft (a rewritten line, a section to add, a test case to write).
- **What the expert says:** the expert's name, the date, the exact `quote` from `criteria.json` in quotation marks,
  and the `clip` link. This is the evidence behind the fix, so always include it.

**Newer standards you're missing.** Missed standards whose `era` is `2026`, one line each. Experts only started
asking for these in 2026, so a draft that would have passed earlier can fail on them now. Skip if none.

**Questions a sharp reviewer will ask.** Three questions the draft can't answer yet, drawn from the misses.

**Full scorecard.** A table: standard | verdict | evidence from the draft (short).

## Rules

- Copy quotes exactly from `criteria.json`. Never paraphrase inside quotation marks, never invent a quote, never cite an
  expert for a standard they aren't listed under.
- Attribute plainly: "Standard from Hamel Husain (2026-01-15)". Never write "Hamel would say…", never imitate an expert's
  voice, and never say or imply an expert approves, endorses or reviewed this draft.
- The quotes come from machine-made transcripts; if the user plans to publish one, tell them to check it against the clip.
- Keep the report about the draft. No lecture on PM theory.
