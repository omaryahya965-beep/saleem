# SALEEM AI Studio — استوديو سَليم الذكي (D207)

The AI Studio creates and corrects advertisements inside SALEEM and ends in the normal workflow: a promotion, a video
version, a full analysis, and human review. **No generated advertisement is ever approved automatically.**

Status on `feature/saleem-v2-completion` (2026-11-21). No real AI request was made while building this. The isolated
test stack blanks the Gemini key (`scripts/isolated-stack.mjs`).

## Two journeys

| Journey | Entry | What happens |
|---|---|---|
| Create with AI | `/new` → «أنشئ إعلاناً بالذكاء الاصطناعي» → `/studio` | Seven steps: (1) product and campaign, (2) creative direction, (3) regulatory context, (4) script, (5) voice, (6) scenes and rendering, (7) preview and save. Saving creates a promotion and its first video version, then analysis starts |
| Upload and correct | `/new` → upload (existing), then `/promotions/<id>/fix` | Manual revision (upload a new version) · AI text correction (Gemini) · video correction in the browser · replacement ad (opens the Studio with `?from=<id>`, saved as a new version) |

## Capabilities and providers

| Capability | Provider | Status | Cost | Notes |
|---|---|---|---|---|
| Ad analysis | Gemini (`analyze`) | Implemented; **awaiting live authorisation** | Paid tier ≈ $0.75 / M input, $3.75 / M output (3.6/3.8 Flash, prices recorded 2026-11-19) | Free-tier eligibility of the configured key has not been checked |
| Script generation | `template` (deterministic) | **Implemented and verified** | Free | Builds scenes from verified claims only, with no AI request |
| Script generation | Gemini (`studio` → `script` / `scene`) | Implemented; **awaiting live authorisation** | ≈ $0.006 per script (≈ 600 tokens in, 1,500 out) | One request, no automatic retry. Quota `ai_limits.script` (default 60/month). Validated against fabricated claims |
| Pre-generation review | Deterministic claims engine | **Implemented and verified** | Free | Covers COM-01 / MAW-01 / AI-01 patterns, fabricated statements, unverified benefits and the first-scene disclosure |
| Text correction | Gemini (`fix`) | Implemented; **awaiting live authorisation** | ≈ $0.01–0.02 per correction | Existing D178 guards; prompt-injection fencing; no invented licences or evidence |
| Arabic / English voice | **Piper (open source, MIT) in the browser** via `@diffusionstudio/vits-web` | **Implemented and verified** | Free | Arabic `ar_JO-kareem` (male only), English male and female. Produces a real WAV. The text stays on the device. The model (~63 MB) downloads once from Hugging Face and is cached |
| Voice | Recording / upload | Implemented (existing) | Free | Recording was blocked in production by `Permissions-Policy: microphone=()`. Fixed: `microphone=(self)` |
| Voice | Gemini TTS / ElevenLabs / HeyGen | **Blocked by provider access** | Paid | Gemini 2.5 Flash TTS lists no free tier. HeyGen needs an API plan; a ChatGPT plugin subscription is not API access |
| Video assembly | Deterministic template renderer (canvas + Web Audio + MediaRecorder) | **Implemented and verified** | Free | Produces a real MP4 (H.264/AAC) or WebM at 720×1280, 1280×720 or 960×960, rendered in real time |
| Video correction | Browser editor (mute, opaque cover, disclosure, subtitles, replacement narration) | **Implemented and verified** | Free | Covers now span the whole appearance of on-screen text between sampled frames (D207 fix) |
| AI images | none | **Blocked by provider access** | Paid | Interface listed as unavailable; nothing simulated |
| AI video footage / avatars | Veo / Runway / HeyGen | **Blocked by provider access** | Paid | Template rendering is never presented as AI footage |

Browser `speechSynthesis` is deliberately not offered: it plays through the speakers and cannot be exported as a file.

## Verification evidence (isolated stack, no AI requests)

- **Studio, created from scratch (`scripts/studio-walkthrough.mjs`):** «كريم لمى (منتج تجريبي)», a fictional
  cosmetic product for Instagram, 15 s, 9:16.
  - Template script with 4 scenes, then the pre-check.
  - 4 Arabic narration clips generated locally.
  - Rendered **MP4, 720×1280, 16.6 s, with a stereo audio track**. Loudness per second shows speech throughout.
    Frames show the burnt-in disclosure band, on-screen text and subtitles.
  - Accepted as a new advertisement: the draft is `accepted`, the version is `ai_used`, the promotion is `draft`,
    and a `studio_accepted` event is recorded.
- **Nada correction (`scripts/nada-correction-walkthrough.mjs`):** the original V1 (fixture analysis, labelled
  «fixture») corrected through SALEEM Fix.
  - Corrected script typed by the tester, since Gemini correction awaits authorisation.
  - Narration generated locally, **replacing the original audio**.
  - Claim ranges muted; the on-screen claim covered opaquely from 9.5 s to the end; «إعلان مدفوع» overlay; subtitles.
  - Rendered MP4 (768×1344, 15.2 s) accepted as **version 2** (`correction_job` accepted, voiceover
    `generated-local`, audio `replaced`). The demo's manually prepared V2 video was not used.
  - A first run exposed two real defects, both fixed and tested: a 92%-opaque cover let the claim show through, and
    covers left the claim fully visible between sampled frames (12–14.5 s).
- **pgTAP `p15_ai_studio`:**
  - drafts are creator-private
  - reviewers and viewers cannot create drafts
  - clients cannot accept a draft or attach results
  - acceptance is validated and idempotent
  - default quotas; owner-only limits; usage cannot be forged
- **Unit tests:** `backend/tests/studio.test.ts` (11) and `frontend/src/test/media-plan.test.ts` (7).

### Replacement and partner workflow (browser, isolated stack)

- **Fix → Studio replacement** (`studio-walkthrough.mjs --from`): the brief is prefilled from the original ad. The
  rendered MP4 (15.2 s) is saved as **version 2 of the same advertisement**; the draft is `replacement`/`accepted`
  and linked to that ad.
- **External partner** (`scripts/partner-walkthrough.mjs`):
  1. Dashboard link, then «create» through the partner link.
  2. **Real video upload.** This exposed and fixed the wizard poster bug that broke *every* video upload (D208).
  3. Submit with the explicit «analysis failed» acknowledgement; the manager assigns; the reviewer requests changes.
  4. The partner sees the reasons, uploads v2, compares and resubmits.
  5. Approval is blocked (`analysis_not_done:failed`, D208), so the reviewer requests changes; the partner sees the
     decision.
- **Partner isolation:** private rows are all the partner's own; only 3 `is_demo` public sample rows are readable (by
  design). A direct read of an internal ad by id returns nothing, and its URL shows nothing.

## Gemini analysis pipeline audit (code review, no requests)

| Item | Finding |
|---|---|
| Model selection | `GEMINI_MODEL` env (`gemini-3.6-flash` locally) overrides the code default `gemini-3.8-flash`. **Neither name was verified against Google in this session.** Verifying it is request 0 below |
| Fallback | `GEMINI_FALLBACK_MODEL` (`gemini-3.1-flash-lite` locally), only on HTTP 503 or an overload timeout. Never another provider |
| Retries | Analysis makes up to 2 attempts per request for retryable errors (backoff 0.8 s → 1.6 s), plus overload retries after 0 / 3 / 8 / 15 s, bounded by a deadline of 2 × 90 s. **A schema-invalid answer is retried once, which is a second billed request.** `fix` and `studio` never retry |
| Limits | 90 s timeout; `maxOutputTokens` 12,000; thinking level LOW; media ≤ 8 MB; 16 frames per batch; prompt ≤ 100k characters |
| Structured output | `responseSchema` for analysis (v1/v2), Fix and Studio; outputs validated (`validateAnalysisV2`, `validateFixOutput`, `validateScript`) |
| Evidence | Findings must cite evidence. A batch that stays invalid after retry is marked failed, and coverage becomes partial (shown in the header since D205) |
| Transcription | Gemini transcription with segment timestamps; the timestamp accuracy of a real run has not been measured in this session |
| Applicability | Rules selected by sector, communication type, publisher and channels (`applicability.ts`); Mawthooq scope is tested (D202) |
| Grouping | Raw evidence consolidated by rule and claim facet (9 → 6 on Nada) |

## Real-provider test plan — **authorisation request (not executed)**

| # | Provider / model | Requests | Purpose | Est. usage | Est. cost | Expected output |
|---|---|---|---|---|---|---|
| 0 | Gemini API `models.list` | 1 | Verify that `gemini-3.6-flash`, `gemini-3.8-flash` and `gemini-3.1-flash-lite` exist for this key | metadata only | $0 (not a generation call) | model names and limits |
| 1 | `studio` script, configured model | 1 | One structured script for «كريم لمى», 15 s, Arabic | ≈ 600 in / 1,500 out | ≈ $0.006 | 4 scenes; validation passes; no fabricated claims |
| 2 | `fix` text correction, same model | 1 | Correct the Nada V1 claims (fixture findings) | ≈ 3k in / 2.5k out | ≈ $0.012 | corrected script and caption without the absolute claims |
| 3 | `analyze` on the Nada V1 video | 1 run (≤ 2 batches; worst case 4 billed calls with retries) | Original advertisement analysis | ≈ 25k in / 6k out | ≈ $0.04 | COM-01 / MAW-01 / AI-01 findings with timestamps |
| 4 | TTS | 0 | Not needed: the local Piper voice is free | — | $0 | — |
| 5 | Video generation | 0 | No provider authorised | — | — | — |
| 6 | `analyze` on the corrected Nada V2 (this run) | 1 run | Corrected advertisement analysis | ≈ 25k in / 6k out | ≈ $0.04 | MAW-01 resolved; COM-01 no longer in speech or on screen; MAW-03/04 still document requirements |

**Total, if all are approved:** about 5 generation runs, roughly **$0.10** at paid-tier prices, or $0 if the key is
on the free tier. Each needs your go-ahead. They will be run once, on the isolated stack with
`ISO_ALLOW_REAL_AI=1`, and their usage recorded.

## Known limitations

- **Local TTS:** there is no Arabic female voice. Speed changes the pitch slightly (playback rate). The first use
  downloads about 63 MB.
- **Rendering:** real time (about the ad's length). The tab must stay in front; background throttling slows it.
- **Studio media** (photos, voice, render) stay in the browser until acceptance; a reload loses them (warned before
  unload).
- **Scene removal and replacement inside an existing video** are not implemented. Covering and muting are; a full
  replacement goes through the Studio.
- **External partners** can correct their own ads (SALEEM Fix) but cannot use the Studio, because partner
  promotions are created through partner links only.
- **Pre-generation review** is advisory and deterministic; the final analysis of the rendered video decides the
  findings.
