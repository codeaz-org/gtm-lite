# GTM-Lite

Cold outbound prep on autopilot — an autogtm-style pipeline that runs entirely on
free tiers: **GitHub Actions** (runner) + **GitHub Models** (LLM, free via
`GITHUB_TOKEN`) + **Exa free tier** (lead discovery, $10 credits/month) +
**your own Gmail** (drafts only — a human sends every email).

```
config.yml ─▶ discover (Exa) ─▶ enrich+score (LLM) ─▶ draft (LLM) ─▶ review PR
                                                                        │ you edit "to:", move to data/approved/, merge
                                                                        ▼
                                                          Gmail drafts in YOUR inbox ─▶ you hit send
```

Nothing is ever sent automatically. That's a feature: it keeps you inside
Gmail's terms, keeps deliverability sane at founder-led volumes, and keeps a
human judgment call on every single email.

## Setup (per project, ~15 minutes)

1. **Use this template.** Click *Use this template* → new repo. One repo = one
   project. Each repo runs independently with its own schedule, quota, config,
   and secrets.
2. **Edit `config.yml`.** Company profile, ICP, lead briefs, limits. This is
   the only file you must touch.
3. **Add secrets** (repo → Settings → Secrets and variables → Actions):
   - `EXA_API_KEY` — free key from https://dashboard.exa.ai ($20 signup + $10/month credits)
   - `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` — see below
   - `HUNTER_API_KEY` *(optional)* — free tier from https://hunter.io (25 domain
     searches/month) as a fallback when scraping finds no address
4. **Enable workflows** (Actions tab → enable). Done. The pipeline runs
   weekdays at 13:00 UTC; edit the cron in `.github/workflows/pipeline.yml`
   or hit *Run workflow* anytime.

### Gmail OAuth (one time per Google account)

1. https://console.cloud.google.com → new project → enable the **Gmail API**.
2. OAuth consent screen → External → add yourself as a test user.
3. Credentials → Create credentials → OAuth client ID → **Desktop app**.
   Copy the client ID and secret.
4. Get a refresh token with the scope `https://www.googleapis.com/auth/gmail.compose`.
   Easiest path: https://developers.google.com/oauthplayground — gear icon →
   "Use your own OAuth credentials" → paste ID/secret → authorize the
   `gmail.compose` scope → Exchange authorization code → copy the refresh token.
5. Save all three as repo secrets. The pipeline can only create drafts
   (`gmail.compose`) — it cannot read your mail or send.

## Daily loop

1. The **pipeline** workflow discovers leads, scores them against your ICP,
   drafts emails, and opens a PR titled `GTM review: <date>`.
2. You review `data/drafts/*.md` in the PR. Each draft arrives with the `to:`
   address **pre-filled** (found by scraping the lead's site, or via the
   optional Hunter fallback; `email_source` tells you where it came from).
   Move the ones you like to `data/approved/`. If `to:` is blank, either fill
   it or skip that lead.
3. Merge. The **gmail-drafts** workflow pushes approved files into your Gmail
   drafts folder and archives them to `data/sent/`.
4. Open Gmail (phone works), give each draft a final glance, send.

## Multiple projects

Template → N repos. Each has its own:
- `config.yml` (different product, ICP, briefs, tone)
- schedule (stagger the crons if you like)
- Exa key (each free account gets its own monthly credits)
- Gmail account (recommended: one sending identity per project)
- Actions quota (free: unlimited minutes on public repos, 2,000 min/month on
  private repos per account — a daily run uses ~2-3 minutes)

No shared infrastructure, no orchestration, nothing to host.

## Make it compound

`knowledge/` is injected into prompts. After real replies come in, append
winning messages, objections, and segment learnings to `knowledge/playbook.md`
(or add new files). The next day's drafts get sharper. This is the part that
actually matters.

## Ground rules

- Keep volumes low (the default caps are deliberate). Cold outreach from a
  personal Gmail at bulk volume gets accounts flagged fast.
- Keep the opt-out line on and honor it permanently (move repliers' ids into
  `data/rejected/` so dedupe never resurfaces them).
- Know your jurisdiction: GDPR/PECR in Europe and CAN-SPAM in the US put real
  constraints on unsolicited B2B email. Personalized, relevant, low-volume,
  easy-opt-out founder mail is the defensible end of the spectrum — stay there.

## Costs

| Piece | Free quota | Enough for |
|---|---|---|
| GitHub Actions | 2,000 min/mo private | ~30x daily runs |
| GitHub Models | free w/ GITHUB_TOKEN (rate-limited) | daily enrich+draft batches |
| Exa | $10 credits/mo (~1,400 searches) | 3 searches/day forever |
| Gmail | free | founder-led volumes |

$0/month per project.
