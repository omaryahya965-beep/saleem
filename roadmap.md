# SALEEM roadmap

## Phase 1

- [ ] Enable Cloud, schema (profiles, rulebook_versions, rules, submissions, transcripts, frames, analysis_runs, findings, compliance_logs, ai_settings, eval_cases, user_roles)
- [ ] Seed rulebook v1, demo account, 2 demo reports (work without AI)
- [ ] Auth + "Try the demo"
- [ ] New check: video/image/text, frames in browser (640px, q0.7), 16 kHz mono WAV audio, hash

## Phase 2

- [ ] Stepped, resumable pipeline (transcribe → deterministic → LLM → merge), persisted per step, Retry button
- [ ] Models configurable from ai_settings (ASR + LLM, frames_to_llm default 24)
- [ ] Text/image-only checks skip transcription
- [ ] Traceability fields on analysis_runs, shown on report + log

## Phase 3

- [ ] Report page, timeline, re-check, compliance log print page, rulebook page, delete media
- [ ] Admin Evaluation page (cases, hits/misses/false alarms)
- [ ] Apply Claude Design bundle (waiting on upload)
- [ ] Arabic RTL + English toggle
