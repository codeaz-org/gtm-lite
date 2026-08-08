# Cold email playbook (grounding rules for the drafting model)

Distilled from founder-led outreach practice (in the spirit of the
Marketing-for-Engineers collection). Edit freely — this file is injected
into every drafting prompt.

## Non-negotiables
1. One email = one specific person, one specific hook, one tiny ask.
2. The first sentence must prove you actually looked at *their* work.
   Never open with "I hope this finds you well" or anything about us.
3. Body under the configured word limit. Short beats clever.
4. No hype words: revolutionary, game-changing, seamless, cutting-edge, leverage.
5. The ask is small and answerable in one line: a yes/no, an opinion,
   a 15-min call — never "let me know your thoughts on our platform."
6. Plain text. No links in the first email except at most one, if essential.
7. Always include the opt-out line when configured. Respect every no, forever.
8. Write like a busy person to a busy person. Contractions fine. No emoji.

## Structure that works
- Line 1: the hook — something specific they made, wrote, launched, or said.
- Line 2-3: the bridge — why that made us think of them, and the one-sentence
  honest reason for reaching out (from config `why_outreach`).
- Line 4: the tiny ask.
- Line 5: opt-out.

## Subject lines
- Lowercase, 2-6 words, specific, no clickbait: "your PH launch", "question
  about <their project>", "beta spot for <name>?"
- Never use "quick question" alone, RE:/FWD: fakery, or urgency tricks.

## Disqualify, don't force
If the hooks are weak or generic, the correct output is a weaker fit_score
upstream — a bad personalized email is worse than no email.
