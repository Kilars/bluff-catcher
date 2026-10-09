# Nightly coaching knowledge base: plan

Settled in a grilling session on 2026-10-09. It supersedes decision 3 ("MTT
only") in `collect-coaching-transcripts.md` and replaces the "offline
authoring aid only" purpose in decision 1. Steps 1–2 of the transcript
pipeline (pull, dedup, extract) carry over. Not built yet.

## Goal

More chips (bb/100) at 6-max 100bb raked cash. The goal is not to fix leaks in
isolation. A sound grounding in fundamentals counts as much as fixing what the
hand histories flag.

## Decisions

1. **Purpose: coach knowledge base.** `hand-review` loads cited briefs at
   review time, so coaching points cite `{video, ts}`. The digest for the
   user comes along almost for free.
2. **Format: cash only.** Queue cash and format-neutral videos and skip
   MTT/ICM ones. The 7 pilot notes stay and get tagged `format: mtt`, and
   cash briefs never cite them.
3. **Three layers.**
   - Per-video notes are canonical and immutable.
   - A concept index (free-form topics, searchable) is derived from the notes.
   - Family briefs (label families plus preflop spots: RFI, cold-call, faced
     3-bet/4-bet, blinds) are derived and loaded selectively by
     `hand-review`.
   - Insights that fit no family go to an `unmapped` inbox, which doubles as
     the queue for label proposals.
4. **Approval: agent review, the user handles escalations only.** (Revised
   2026-10-09: the user isn't a poker expert, so a per-claim human gate added
   little.) After the three extraction runs, `kb-autoreview` runs on Opus,
   independent of the Sonnet extractor, and checks every staged claim:
   - grounded: the quote is at the cited timestamp
   - fits 6-max 100bb cash
   - agrees with the repo's ground truth (`src/lib/preflop/`, strategy notes,
     leak-coaching)
   - conflict rule: GTO Wizard is the baseline, and other coaches pass only as
     population-tagged exploits

   Passing claims merge into the briefs, and every verdict is logged in
   `kb/review-log.md`. Only true draws and possible repo fixes reach
   `kb/escalations.md`, which the user settles in `kb-review`. That's also
   where they can veto a merged claim. Changes to `labels.ts` and
   `leak-coaching.md` still need the user's per-item approval as dev-hat work.
5. **Stance: GTO baseline first.** Each brief states the solver baseline
   first. Exploits sit beside it, tagged with the population they assume. The
   coach says which one it is applying.
6. **Queue: EV-weighted fundamentals.** Filter to strategy content: cash or
   neutral, over 10 minutes, a usable transcript, no highlights, promos or
   news. Rank by how often the spot comes up at 6-max 100bb times how costly
   the typical mistake is. Matches to the user's hand-history findings boost
   a video's rank, and popularity breaks ties.
7. **Runtime: a local systemd user timer at 03:00 runs the `kb-nightly`
   skill** through `claude -p "/kb-nightly"` with a restricted
   `--allowedTools`. `Persistent=true` means a missed run catches up on the
   next wake. The service runs the skill three times a night, one video
   per run, each in fresh context. No new script: the skill
   orchestrates pieces that already exist (`yt-dlp`, the `curl` transcript
   method, `dedup-captions.py`, the extraction prompt). The corpus stays in
   the gitignored `research/coaching-transcripts/`. Cloud `/schedule` was
   rejected because routines clone the public repo and can't see the
   gitignored corpus, and a private KB repo wasn't worth the extra moving
   part. The unit files are versioned in `research/systemd/`.
8. **Stop rule: saturation.** Each run scores how many of its claims are new
   rather than already cited. After 5 low-novelty runs in a row it pauses
   itself and says so in the digest. Adding channels or new findings re-arms
   it.
9. **Delivery: rolling local digest.** Each run prepends an entry to
   `research/coaching-transcripts/digest.md` with the title, a link, 3–5
   takeaways that make chips, and what it staged. Nothing leaves the machine.
10. **Channels: GTO Wizard plus four the user picked.** Each was checked on
    2026-10-09 for size, cash share in titles, and a full transcript from
    `youtube-transcript.ai` (7.6k–22.7k words per test video). Videos are
    listed with `yt-dlp --flat-playlist --print
    "%(id)s\t%(view_count)s\t%(duration)s\t%(title)s" <channel>/videos`.

    | Channel | Handle | Role | Filter note |
    |---|---|---|---|
    | GTO Wizard | `@GTOWizard` | GTO baseline (authoritative) | drop highlights, product promos, MTT |
    | Uri Peleg | `@UriPelegPoker` | online cash liveplay 50NL–1kNL, solver explainers | closest to the user's game |
    | Red Chip Poker | `@RedChipPoker` | low-stakes 6-max fundamentals, exploits | tag exploits by population |
    | Upswing Poker | `@Upswingpoker` | preflop and fundamentals | heavy PLO/MTT mix, filter hard |
    | PokerCoaching | `@PokerCoaching` | fundamentals (math, hand classes) | top views are entertainment/MTT, filter hard |

    Raw popularity is noisy: the most-viewed videos are often table drama
    (Kabrhel, Tom Dwan). The content filter and EV ranking (decision 6) do
    the real selection.

## Open, decide while building

- Exact novelty metric and the "low" threshold.
- Where staging lives and the diff format `kb-review` reads.
- How the EV score is estimated from title, description and chapters, before
  the transcript is pulled.
- Retry and skip policy when transcript fetch or `claude -p` fails (default:
  log it in the digest, mark the video skipped, move on).
