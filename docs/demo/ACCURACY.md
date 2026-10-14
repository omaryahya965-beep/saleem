# SALEEM — accuracy summary (pitch slide)

> Measured 2026-10-13 with **gpt-6.1-sol** (prompt v3-2026-10) on 12 Saudi-dialect test cases (backend/eval/cases.json, text mode).
> Small, synthetic test set — indicative, not a production accuracy claim.

## Slide numbers

| Metric | SALEEM (rules + model) | Rules only |
|---|---|---|
| Recall (issues found) | **100%** (17/17) | 53% |
| Precision (alerts that were right) | **94%** (1 false alarm) | 100% |
| Timestamp error (timed issues) | **0 s** mean | — |
| Time per check (text) | 7.5 s | instant |
| Model cost per check (text) | $0.0057 | $0 |

Video clips (docs/demo/CLIPS.md): 22 s synthetic ad → 6 findings, 5/5 expected rules, claim pinned at 8.2 s, ~30 s end-to-end, $0.016–0.027 per clip; fixed version → ready, 0 findings.

## Per rule

| Rule | Hits | Misses | False alarms | Recall | Precision | Mean t-error |
|---|---|---|---|---|---|---|
| AI-01 | 2 | 0 | 0 | 100% | 100% | — |
| CNT-01 | 1 | 0 | 0 | 100% | 100% | 0.0 s |
| CNT-02 | 1 | 0 | 0 | 100% | 100% | 0.0 s |
| CNT-03 | 1 | 0 | 0 | 100% | 100% | 0.0 s |
| CNT-04 | 1 | 0 | 0 | 100% | 100% | 0.0 s |
| CNT-05 | 1 | 0 | 0 | 100% | 100% | 0.0 s |
| COM-01 | 3 | 0 | 1 | 100% | 75% | 0.0 s |
| MAW-01 | 2 | 0 | 0 | 100% | 100% | 0.0 s |
| MAW-02 | 3 | 0 | 0 | 100% | 100% | — |
| MAW-03 | 1 | 0 | 0 | 100% | 100% | — |
| MAW-04 | 1 | 0 | 0 | 100% | 100% | — |

## Honest limits

- 12 hand-written cases and 2 synthetic clips; real creators' clips not yet evaluated.
- Known false alarm: perfume "lasts all day" flagged as a misleading claim (COM-01).
- Whisper can mis-hear dialect words in compressed audio ("ينحث" for "ينحف"); the vision model and on-screen text compensated in the demo clip.
- Rules are illustrative and pending legal review.

Reproduce: `npm --workspace backend run eval` and `npm --workspace backend run clips`.
