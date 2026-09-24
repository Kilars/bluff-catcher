# Collect coaching transcripts — input-data step

Purpose and design were settled in a grilling session. This file is the
runnable prompt for **step 1: collection**. Extraction (step 2) and synthesis
(step 3) are sketched at the bottom but are separate passes.

## Design decisions (locked)

1. **Purpose — offline authoring aid only.** The corpus informs hand-written
   labels + rubric; it never ships and is never read at runtime. Everything
   under `research/coaching-transcripts/` is gitignored (third-party content,
   public repo).
2. **Mining targets:** the checking *rubric* (how a coach decides a decision was
   wrong), candidate *labels*, *vocabulary/framing*, and *focus/priority* — the
   order in which a coach reaches for factors.
3. **Scope — MTT only.** Cash coaching (e.g. Crush Live) is excluded: its
   stack-depth / no-ICM assumptions mislead on tournament spots.
4. **Extraction — one subagent per video** emits a fixed schema; humans read the
   notes, never the raw 35k-word transcript. Every entry cites `{video, ts}`.
5. **Approval — batch then per-item.** All notes accumulate; one synthesis lists
   proposed rubric edits / candidate labels / vocab / focus-order, each cited;
   the user approves item-by-item before anything touches `labels.ts` or
   `docs/leak-coaching.md`. Nothing auto-applied.
6. **Label bar — no hard gate yet.** Existing taxonomy stands; adjust only if
   the mined data clearly warrants.
7. **First pass — small pilot, 3–5 MTT videos.** Prove the schema, review, then
   scale.

## Transcript method (verified working 2026-09-21)

```bash
curl -sS --max-time 40 "https://youtube-transcript.ai/transcript/{VIDEO_ID}.txt"
```

- Plain GET, no auth, Cloudflare-cached ~24h. Returns a metadata header
  (title, source, language, duration, word count) then `## Transcript` with
  `[m:ss]` timestamps.
- **Do not use WebFetch** to capture the text — it paraphrases via a small model.
  `curl` returns verbatim; WebFetch is fine only for a quick "does a transcript
  exist" probe.
- Fallbacks if it fails: `youtubetranscript.us` (flaky), `transcriptapi.com`
  (dev API). If all fail or the transcript is music/near-empty, record
  `NO USABLE TRANSCRIPT` and move on.

## Seed list — MTT only

Verified (transcript pulls clean):
- `Gtdc3C1IIwE` — Jonathan Little, "High Stakes Tournament Hand Review [MTT]" — decision-vs-GTO format.

Candidates to confirm are MTT + have a usable transcript before collecting:
- `i4ByPN8OsZk` — "Online MTT Review [Live Hand History]"
- `tT7ugcaHfIs` — "MTT Poker Study Simplified"
- `jPP3eFRDwNk` — hand-history technique walkthrough

Gather ~2–3 more IDs from these MTT sources (pick hand-review / session-review
episodes, not pure theory lectures):
- `@PokerCoaching` (Jonathan Little) — filter to MTT reviews
- `@mttpokerschool` (Gareth James) — MTT-only channel
- Playlist `PLGSraHXzm7hdyTpQAY4AOm61yhvc61Pul` (Tournament Poker Strategy Hand Analysis)

**Exclude** cash: Crush Live / Bart Hanson, Hustler Casino Live cash reviews, etc.

## Collection procedure

For each chosen `{VIDEO_ID}`:

1. `curl` the `.txt` endpoint → save verbatim to
   `research/coaching-transcripts/raw/{VIDEO_ID}.txt`.
2. Confirm it's MTT and speech-rich (word count in the thousands, real spoken
   content, not `[Music]`). If not, log `NO USABLE TRANSCRIPT` and skip.
3. Produce `research/coaching-transcripts/clean/{VIDEO_ID}.md`:
   - **Collapse the rolling-caption repetition.** YouTube auto-captions arrive
     ~3× duplicated per line (`"welcome to another welcome to another…"`);
     de-duplicate consecutive repeated phrases so each sentence appears once.
   - Strip promo/boilerplate (subscribe pitches, coupon codes, intros).
   - **Keep the `[m:ss]` timestamps** — extraction cites them.
4. Append a row to `research/coaching-transcripts/manifest.md`:
   `{VIDEO_ID} | coach | title | format=MTT | duration | raw_words | clean_words | url | pulled_at`

Stop at 3–5 usable videos.

## Next passes (not this step)

- **Step 2 — extraction (one subagent per clean transcript).** Emit YAML:
  ```yaml
  - spot: check-draw            # or the coach's own name for it
    looks_at: [board, nut-share, num_villains, spr]   # in the order stated
    wrong_when: "…concrete criterion…"
    right_when: "…"
    priority: high|med|low      # how heavily the coach weights it
    labelable: yes|no           # computable as a predicate over parsed fields?
    src: {video: VIDEO_ID, ts: "12:04"}
  ```
- **Step 3 — synthesis.** Merge notes across videos → `synthesis.md` grouped by
  target (rubric / candidate labels / vocab / focus-order), each item cited.
  User approves per-item; only approved items reach `labels.ts` /
  `docs/leak-coaching.md`.
