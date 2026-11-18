# Gemini integration: team review

Review date: 2026-11-17. Compared the complete feature diff, including new files and the lockfile, with fetched default branch `origin/master` (`323e7da`). No hosted project or production configuration was changed.

## Review outcome

Ready for team review with the inherited dependency audit failure disclosed. No confirmed new remotely exploitable vulnerability remains from this review; this is a scoped change review, not a guarantee that the repository is vulnerability-free. The existing CI security audit remains enabled and currently fails on inherited advisories.

CodeRabbit reviewed the initial 36-file patch and raised **6 minor issues, 0 major, 0 critical**. All comments were checked against the code; follow-up changes were reviewed locally and tested.

| Issue | Disposition |
|---|---|
| Setup/probe required a dotenv file even with an environment-only key (two comments) | Fixed both file reads; verified with a disposable checkout and mocked probe transport. |
| Missing seed-section marker could copy demo sections into a bootstrap migration | Fail explicitly before slicing; checked missing-marker behavior. |
| Model could emit deterministic disclosure/contract/license findings despite the prompt | Validator rejects MAW-01/03/04; three regression cases retain the two-attempt bound. |
| Quoted model, placeholder key, default-model/cost mismatch | Fixed quoted model and placeholder handling. Retained the live-verified 3.5-flash-lite selection instead of the suggested 3.8 fallback because 3.8 failed minimal generation. Unknown 3.5 cost is disclosed below. |
| English clean-result assertion did not match the actual translation | Corrected to the dictionary text; Arabic/English/mobile report tests pass. |

Additional checks and changes:

- Canonical regulatory titles, source names and URLs resolve only from database rules pinned to the run version. Unknown codes fail validation; model source fields are discarded. Tests inject fabricated reference fields and verify the database source wins or no source appears. A historical-report test verifies the old reference remains after a new version is published.
- Advertisement text/media is untrusted model input; raw output is validated, React renders explanations as text, and model output cannot create a regulatory hyperlink. Free-form explanations can still make incorrect legal assertions; human/legal review remains necessary.
- Gemini credentials and SDK remain server-side. Media downloads are restricted to configured storage origin/path, disallow redirects, and enforce byte/time limits. Auth, ownership, non-demo restrictions, RLS and private storage remain enabled.
- Persistent 503 has exactly two attempts, one exponential backoff with jitter, 45-second per-attempt timeout, and a 120-second multi-batch analysis deadline. No nested SDK retries. Exhaustion stores the existing translated failure code; UI offers manual retry and produces no successful report or mock findings. Permanent auth/access/model errors do not retry.
- Local setup now excludes every dotenv file from runtime source copying, validates model syntax and rejects template keys. Credential files enforce mode 600 on overwrite; credential-bearing local HTTP calls reject redirects. Ignore rules protect local runtime/status/credential outputs.
- Removed unnecessary direct Mac binary declarations; lockfile retains required transitive platform packages. A clean independent install confirmed the three Apple Silicon binaries exist. Existing dependency versions did not change. The six-line image formatting adjustment is required by the existing Prettier lint rule.
- Fixed the existing mocked-auth helper to honor Vite production env precedence, including the ignored local override. This prevents falsely signed-out local browser tests; it changes no application authentication.
- Three public verification checks initially failed on both this branch and an untouched default-branch checkout against the same local database. The copied seed inserted synthetic demo logs without a report hash. Local-only seed preparation now calls the existing trusted sealer for demo rows after insertion. Four demo reports verify correctly; no verification check was bypassed and no real submission was resealed.
- Scope reviewed: provider/validation/pipeline/error/cost changes; diagnostics/auth guard; report/reference/i18n changes; setup/probe/evaluation/browser tools; unit/browser tests; package manifests/lockfile; CI/import maps; ignore rules and documentation. Production migrations/config/seed are unchanged.

## Git and secret boundary

Only templates are tracked for environment configuration. Actual `.env`, `.env.local`, `.env.functions`, local service-role credentials, synthetic account passwords, status output, database volumes/data, logs, dist and test screenshots/traces are excluded or outside the checkout. Known-value scans cover candidate/index files and the built frontend. Public local Supabase anon keys are intentionally browser-visible; Gemini/service-role keys and passwords are not. Existing generated router/schema source and historical evaluation fixtures were already tracked on the default branch; this branch does not add generated runtime output.

Local runtime: sibling `../saleem-local`, separate CLI project `saleem-gemini-local`, API 55421, DB 55422. Production configuration is never overwritten. See [the reproduction guide](GEMINI_INTEGRATION.md).

## Dependency advisories

Current registry audit was run separately on the feature lockfile and a disposable copy of the default-branch lockfile. Results are identical: **18 affected package entries (10 high, 8 moderate)** for the full graph; **9 entries (8 high, 1 moderate)** with `--omit=dev`. Counts include propagated dependency entries, not 18 distinct CVEs. No existing package version changed and no new SDK dependency has an advisory in this snapshot. `npm audit --omit=dev --audit-level=high` exits nonzero on both branches.

| Affected installed dependency | Impact on SALEEM and follow-up |
|---|---|
| Vite 8.1.5 and propagated entries, high overall | Development-server/editor execution, cross-origin middleware execution and file-access issues, including Windows escaping/path checks. The repository enables `server.host`; the local guide now explicitly binds loopback. Static production assets do not run Vite middleware. Investigate a dedicated Vite patch update and test its build/plugin compatibility. [Editor issue](https://github.com/advisories/GHSA-r825-w8mm-5pxw), [file access issue](https://github.com/advisories/GHSA-rq7h-c2jc-7f22). |
| picomatch 4.0.7, high; propagated through fdir/tinyglobby/unplugin/TanStack build tools | Malicious glob patterns can consume excessive CPU. No advertisement-to-glob execution path was found; risk concerns build/dev tooling and untrusted repository/config input. The advisory lists no patched release as of review. Do not apply npm's suggested TanStack downgrade blindly. [Advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf). |
| Seroval 1.6.9 via TanStack router, moderate | Code/script injection requires vulnerable serialization of an attacker-controlled RegExp or a modified typed array. This SPA does not use those constructions for model results; no reachable Gemini path found. Upgrade the compatible transitive version to at least 1.6.11 in a separate dependency change. [Typed arrays](https://github.com/advisories/GHSA-f86p-h4j2-7qgj), [RegExp](https://github.com/advisories/GHSA-9wx9-5pv9-3349). |
| Vitest 4.1.11 / @vitest/mocker, high propagated and moderate direct entries | A reachable dev-server mocking endpoint can accept crafted registrations. SALEEM uses one-shot Node/jsdom tests and does not register the vulnerable browser mock plugin in the production app. Upgrade to a compatible patched test-tool version (mocker 4.1.12+). [Advisory](https://github.com/advisories/GHSA-qxg6-89mg-rqv8). |
| minimatch 10.2.6 via typescript-eslint, moderate plus propagated entries | Excess CPU/memory requires attacker-controlled glob preprocessing. Developer lint/config exposure; advertisement input is not used as a lint glob. A compatible ESLint dependency update requires testing; upstream patched minimatch is 11.0.1. [Advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249). |

Reachability statements are code-review inferences, not proof of non-exploitability. No dependency audit gate was weakened and no broad `npm audit fix --force` upgrade/downgrade was performed. These advisories remain a merge/release decision for the team.


### Current advisory inventory

| Package | Advisory | Affected range from npm |
|---|---|---|
| @vitest/mocker | [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) | `>=2.1.0-beta.7 <4.1.12` |
| @vitest/mocker | [GHSA-xp26-3454-mjgp](https://github.com/advisories/GHSA-xp26-3454-mjgp) | `>=4.1.11 <4.1.12` |
| minimatch | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) | `>=7.0.0 <11.0.1` |
| picomatch | [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) | `<=4.0.7` |
| seroval | [GHSA-9wx9-5pv9-3349](https://github.com/advisories/GHSA-9wx9-5pv9-3349) | `>=1.5.5 <1.6.10` |
| seroval | [GHSA-f86p-h4j2-7qgj](https://github.com/advisories/GHSA-f86p-h4j2-7qgj) | `>=1.6.0 <1.6.11` |
| vite | [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) | `>=8.0.0 <=8.1.5` |
| vite | [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv) | `>=8.0.0 <=8.1.5` |
| vite | [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw) | `>=8.0.0 <=8.1.5` |
| vite | [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw) | `>=8.0.0 <=8.1.5` |
| vite | [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) | `>=8.0.0 <=8.1.5` |

## Final verification

| Check | Result |
|---|---|
| Clean npm install | PASS, including independent fresh-directory platform binary check |
| Unit tests | PASS: 37 frontend + 140 backend = 177; includes 47 mocked Gemini tests |
| Live local two-user isolation | PASS: 7; one skip-notice assertion skipped because the live suite is enabled |
| Browser regression suite | PASS: 39 across Arabic/English desktop and Arabic mobile; includes 6 Gemini report/error contracts |
| Frontend TypeScript | PASS |
| Deno analyze, cleanup-media, account, diagnostics | PASS |
| Lint | PASS: 0 errors, 17 existing Fast Refresh warnings |
| Production build | PASS: Vite SPA and all 12 public prerender routes; bundled Chromium installed |
| Local setup parsing/permissions checks | PASS: environment-only credentials, quoted model, template rejection, missing marker, dotenv-copy exclusion, overwrite permissions; no real provider request |
| Dependency audit gate | FAIL, identical inherited findings on default branch; described above |

The browser suite combines real local public seed data and mocked signed-in/report API contracts. It does **not** establish live Gemini accuracy. Default-branch comparison failures were investigated before the local seed correction; they were not relabeled as passes.

## Prior real Gemini evidence

All five requested end-to-end cases passed on 2026-11-17 through real local password authentication, private upload, JWT-verified Edge Function, Google generation, persisted non-demo run and frontend report. These live results predate this review's validation/setup hardening; final regression tests above are separate. No additional live Gemini calls were needed for this review. Model: `gemini-3.5-flash-lite`. Rulebook: `2026.10-a`.

| Live case | Outcome | Wall time | Analysis input/output tokens |
|---|---|---|---|
| arabic-text | PASS | 5.50s | 1892/28 |
| misleading-claim | PASS | 9.56s | 1895/475 |
| image-ad | PASS | 18.73s | 6011/1092 |
| arabic-video | PASS | 37.65s | 18624/808 |
| insufficient-evidence | PASS | 5.63s | 2975/261 |

The video had 15 frames, three Arabic transcript segments, and 432 input / 715 output transcription tokens. Image/text claims produced existing COM-01 findings; uncertainty produced MAW-02 warnings and bilingual review notices. Failed requests never produced demo findings. Screenshots and sanitized request/run/usage records are retained outside Git in the task's `outputs/` folder and can be attached when a PR is approved.

## Known limits and rollout considerations

- Independent bare-text API tests: all requested models were listed/accessible, but 3.8 returned 503 on all three attempts and 3.6 timed out on all three 20-second attempts. 3.5 succeeded with text, JSON, Arabic, image and direct video. Intermittent 503 remains a provider availability risk.
- Both provider selectors now default to Gemini. Existing deployments relying on implicit OpenAI defaults need explicit `LLM_PROVIDER=openai` / `TRANSCRIPTION_PROVIDER=openai`, or Gemini credentials and model configuration, before adopting the branch. No deployment was performed.
- 3.5-flash-lite has no built-in price entry. Stored zero cost means unavailable estimate, not free usage. Token usage is the evidence; configure a verified `PRICE_GEMINI_3_5_FLASH_LITE` override when estimating costs. No billing was enabled.
- Long video/multi-batch requests can exceed hosted worker wall-time limits; only the isolated local environment was verified. Audio extraction must be supported by the browser; raw video audio fallback fails explicitly.
- Generative OCR, timestamp and legal interpretation accuracy needs broader expert evaluation. The illustrative database rulebook requires legal review. Canonical references are controlled by database rules; this does not guarantee hallucination-free prose.
- No push, merge, deployment or PR publication is part of this preparation.
