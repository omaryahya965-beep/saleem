# SALEEM MVP: Build Plan

## AI services (please confirm)
- **Speech-to-text:** `openai/gpt-transcribe` through Lovable AI (built in, no key needed). It handles Arabic and returns timestamped segments. It sits behind a provider interface so it can be swapped later.
- **LLM checks (text + frames):** `openai/gpt-6-astra` through Lovable AI, with strict JSON-schema output and vision for frames.
- **Claude option:** Lovable AI can also call Claude (e.g. `anthropic/claude-sonnet-5`) with no personal key. If you'd rather use your own Anthropic key, I'll store it as a secret and call the Anthropic API directly. Either way the provider interface stays the same.

## Phase 1: Data model, auth, upload, demo reports
- Turn on Lovable Cloud. Create tables for `profiles`, `rulebook_versions`, `rules`, `submissions`, `transcripts`, `frames`, `analysis_runs`, `findings` and `compliance_logs`, using the same fields and enums as your spec (status READY / REVIEW / NEEDS_FIXES, severity ok / warning / violation, platform, category, media type).
- Row-level security: owners can read and write their own submissions, transcripts, frames, runs, findings and logs. Everyone can read rules, rulebook versions and the two demo submissions (`is_demo = true`).
- Seed the rulebook v1 rules, each marked "illustrative – pending legal review" with its source link. Seed two demo reports (one NEEDS_FIXES, one READY linked to its previous version) and a demo account.
- Private `media` bucket, accessed through signed URLs only.
- Auth: an email + password sign-in page, plus a "Try the demo" button.
- New check form: video (≤ 90 s, ≤ 25 MB), image or text; caption, platform, category, 3 toggles, optional Mawthooq number; inline validation.
- In-browser frame extraction (video + canvas): one JPEG every 2 s (max 45) plus the first and last frame, each tagged with its timestamp. Also compute a SHA-256 file hash in the browser.
- Upload the media and frames to storage, then create the submission row.

## Phase 2: Analysis pipeline
- A server function runs the stages and updates `progress` and `stage` on the submission row. The UI polls every 2 s.
- Stages: transcribe → deterministic checks → LLM checks → merge → status.
- Deterministic checks: Arabic disclosure keywords (إعلان، #إعلان، مدفوع، برعاية…) in the caption or the first 5 s of speech when the paid toggle is on; a discount-code regex; health and finance claim patterns; metadata rules (paid without a contract, AI used without a label, missing Mawthooq number on a paid ad).
- LLM checks: strict JSON per your schema. Validate the response and retry once on failure. Drop findings whose rule code isn't in the rulebook, and downgrade findings with weak evidence to "warning".
- Dedupe deterministic and LLM findings on the same rule within 3 s.
- Prompts enforce neutral visual descriptions and no identification of people.
- Status: any violation → NEEDS_FIXES; warnings only → REVIEW; otherwise → READY.

## Phase 3: Report and related pages
- Report page: video player plus a timeline with markers positioned at t_start / duration. Clicking a finding or marker seeks the video and highlights the finding, and works from the keyboard. Findings show as a table on desktop and stacked cards on mobile. Every report shows the disclaimer.
- Re-check: upload a fixed version linked to the original through `parent_submission_id`, with a link back to the previous version.
- Compliance log: a printable RTL A4 page using the browser's native Arabic text shaping, with a "Save as PDF" button that uses the print dialog. It shows the submission id, file hash, rulebook version, findings, timestamps and the disclaimer.
- Rulebook page: active rules grouped by category, with source links and the version.
- Privacy: a "Delete media" button removes the stored files and keeps only findings and hashes. A daily scheduled job deletes media 24 h after analysis.
- Arabic-first RTL with an English toggle that switches to LTR, using a lightweight dictionary and logical spacing classes.

## Design
- Screens, tokens, components and copy follow your Claude Design bundle exactly. **Please upload it before Phase 1's screens.** Until then I'll build the data and logic layers and use the tokens from your written design spec.

## Technical notes
- Server logic uses TanStack server functions with auth middleware. Uploads go straight from the browser to storage. Analysis reads frames through signed URLs.
- Video over 25 MB: I'll extract the audio in the browser (WebAudio to WAV) before transcribing.
