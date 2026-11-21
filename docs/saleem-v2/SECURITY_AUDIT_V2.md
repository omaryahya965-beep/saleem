# SALEEM V2 security audit (V2 completion §21, 2026-11-21)

**Scope:** every permission surface touched by V2: RLS policies, SECURITY DEFINER RPCs, storage, Edge Functions,
direct URLs and the UI gates. The audit ran on the isolated local stack (`scripts/isolated-stack.mjs`, project
`saleem_iso`). **Production was not touched**, and no production setting was changed.

**Method.** Evidence comes from automated tests run against a real Postgres with RLS:

- **pgTAP.** 25 files, 277 checks. Each one signs in as a role through `request.jwt.claim.sub`, then runs the call
  directly.
- **Vitest integration suites.** These call PostgREST and RPC endpoints straight through `supabase-js` as the real
  demo personas (`rbac.test.ts`, `isolation.test.ts`, `workflows.test.ts`, `demo-login.test.ts`).
- **Browser walkthrough.** `scripts/browser-walkthrough.mjs` opens every visible page for each of the nine roles and
  probes the management URLs directly.

## Results by requirement

| Requirement | Result | Evidence |
|---|---|---|
| Cross-organisation isolation | Pass | `rbac.test.ts` «other organisations stay invisible», «different roles in two organisations»; `isolation.test.ts` (rows and media of user A are unreadable, unlistable and unwritable for user B) |
| External partner isolation | Pass | `rbac.test.ts` «partners and external reviewers never see internal advertisements»; `p6_partners`, `p9_upgrade` (identity binding, limits, product/channel restriction, expired/revoked/rotated links). /org shows the partner only its own membership and assigned links (D201) |
| Legal advisor case isolation | Pass | `rbac.test.ts` D3 «legal reads only its case» (the ad, its linked claim, product and applicable disclaimer); walkthrough: legal sees 5 entries and is refused /features, /roles, /company-rules, /audit, /org |
| External reviewer restrictions | Pass | `p8_roles_matrix`; walkthrough: 2 entries, every management URL refused. The role grants no access until explicit sharing is enabled (documented limitation) |
| Viewer read-only | Pass | `rbac.test.ts` «the viewer is read-only through the API too»; `p10`–`p13` (viewer refused for corrections, comments of restricted kinds, rules, settings) |
| Unauthorised approvals | Pass | `p7_self_approval`, `p11_governance_audit` (D186: open violations, unanswered findings, multi-level flows, financial promotions, partial coverage, evidence and conditions all block self-approval); `rbac.test.ts` «cannot approve an advertisement they uploaded»; `can_decide` blocks approval while confirmed violations remain (Nada run: `confirmed_violations:4`) |
| Unauthorised assignment | Pass | `rbac.test.ts` D2 «reviewers never assign; managers assign; only the assignee opens and decides»; `p3_review` |
| Unauthorised advertisement modification | Pass | `isolation.test.ts` (no forged status, no direct writes to findings); `p1_promotions`; reviewers and viewers cannot start corrections (`p10_fix`) |
| Conditional approval verification | Pass | `p9_upgrade`, `p11_governance_audit`: only the decider side verifies; a note is required for rejection or more evidence; conditional approval cannot record publication (D186) |
| Evidence attachments | Pass | Attachments are stored under the uploader's prefix in the private `submissions` bucket (`isolation.test.ts`); comment links are plain URLs validated by `add_comment` (`p12_collaboration`) |
| Mentions | Pass (fixed in V2) | `p12_collaboration`: only promotion readers can be mentioned; external users see role names, not other ads' titles (D189) |
| Notifications | Pass | RLS restricts each user to their own rows; `notify_*` helpers are not executable by clients (`p3_review`, `p12`, `p14`) |
| Partner invitation and link management | Pass | `p6_partners`, `p9_upgrade` (manager-only create/rotate/revoke, token stored hashed, access requests decided by managers) |
| Feature flag enforcement | Pass | Server-side `feature_off` checks in RPCs (`p10_fix`, `p6_*`, `p7_api_webhooks`); UI gates are cosmetic only |
| AI correction permission | Pass | `p10_fix`, `p14_fix_media`: uploader-side only, idempotent, one active job, no claiming someone else's job, acceptance never inherits approval |
| Quota enforcement | Pass | `p10_fix` (`quota_exhausted`), analyse rate limit (`rate-limit.test.ts`), plan quota (`p1_promotions`) |
| Demo account isolation | Pass | `demo-login.test.ts`: allow-listed personas only, one-time token, refuses a demo user who is also a member of a real organisation; `is_demo_sandbox_user` and `demo_ai_runs_today` are service-role only (D187) |
| Audit integrity | Pass | `p2_findings_rule_checks`, `p6_lifecycle`, `workflows.test.ts` «sealed decision chain verifies» (hash chain) |
| Historical decision immutability | Pass | `p3_review`, `p6_risk`, `p7_self_approval`: decisions and events are insert-only for clients; there are no update or delete policies |

## Findings fixed during this audit

1. **Self-approval with open violations (D186).** Self-approval was allowed when every finding had an answer, even
   with confirmed violations open. Fixed and covered by negative tests.
2. **Mentions leaked advertisement titles (D189).** Anyone in the organisation could be mentioned, and the mention
   list showed ad titles to non-readers. Mentions are now restricted to promotion readers.
3. **Demo AI quota (D187).** Public demo personas had no shared AI cap. Now `DEMO_AI_DAILY_LIMIT` (default 40) applies
   across all sandbox users. The `demo-login` default rate dropped from 500 to 20 per IP per hour (the code default;
   production overrides it through env).
4. **Spoofable demo rate-limit key (D204).** `demo-login` hashed the first `X-Forwarded-For` entry, which the client
   chooses. Rotating that value bypassed the per-IP limit. The key is now `cf-connecting-ip`, then `X-Real-IP`, then the
   last hop (`client-ip.test.ts`).
5. **Stuck acceptance (D198).** An interrupted upload could leave a SALEEM Fix job in `accepting` forever. Only its
   creator can re-claim it, and only after 10 minutes with nothing linked (`p14_fix_media`).

## Recommended production changes (not applied — need your authorisation)

| Setting | Current production | Recommended | Why |
|---|---|---|---|
| `DEMO_RATE_PER_HOUR` | 500 | 10–20 | 500 demo sessions per IP per hour is effectively unlimited for a public endpoint |
| `DEMO_AI_DAILY_LIMIT` | not set (code default 40) | set explicitly, 20–40 | Caps the Gemini spend that anonymous demo visitors can trigger |
| `DEMO_IP_SALT` | default constant | random secret | IP hashes in `demo_sessions` cannot then be reversed by brute force |
| `ANALYZE_RATE_LIMIT_PER_HOUR` | default 30 | keep, or 10 for demo personas | Per-user limit on analysis starts |
| Deploy the D204 fix | — | deploy `demo-login` with this branch | Without it the per-IP limit can be bypassed |
| Gemini key | set | billing alerts or budget cap in Google Cloud | A hard ceiling independent of app logic |

## Residual risks

- The external reviewer role has no data access until explicit sharing is built. That's safe, but the feature is
  incomplete.
- Mawthooq licence verification is manual. No official API is available, and SALEEM does not scrape the official site.
- UI-only gates (for example nav entries visible to viewers) are not security boundaries. Every write is enforced
  by RLS or an RPC.
