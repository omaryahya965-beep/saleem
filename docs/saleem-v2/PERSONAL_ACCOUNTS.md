# Personal accounts and automatic multi-regulator analysis (D211–D215)

SALEEM serves two audiences with two different experiences:

| | Individuals and content creators | Companies and organisations |
| --- | --- | --- |
| Workspace | A **personal workspace** (`personal_workspaces`): the user's own advertisements (`promotions.org_id is null`, `owner_id = user`) | An organisation (`organizations`, `org_members`) |
| Roles | None. It is not a tenth role | The nine organisation roles, unchanged |
| Workflow | Upload → sector and publication context → automatic multi-regulator analysis → findings and evidence → smart correction → version comparison → re-analysis → download | Create → check → correct → collaborate → review → approve |
| Human approval | None, and none can be produced (every review/approval RPC refuses a personal advertisement) | Required, by an authorised person |
| Regulators | **All supported authorities, automatically.** The user chooses the sector, never authorities | The organisation's rule-pack settings |

One user can have both a personal workspace and organisation memberships. The account menu switches between them,
and switching drops cached data so nothing from one workspace shows in the other.

## Regulatory analysis for individuals (D213)

- **The user never selects or excludes regulators.**
  - The check flow asks for the **sector** (banking and financing, investment, cosmetics, food and beverages,
    healthcare, tourism, e-commerce, retail, real estate, general content, other) and the **publication context**
    (own product or service / sponsored by someone else / unpaid personal content), plus paid status, AI use and the
    Mawthooq licence.
  - A read-only panel shows what SALEEM can verify per authority.
- **Every supported authority is considered.** A personal analysis enables every rule pack (GMEDIA, MC, SDAIA, SFDA,
  SAMA, CMA, IA, MT, REGA, MOHU and the system checks). Rule applicability then decides what applies: sector, channels,
  paid status, AI use, communication type, distribution.
- **Draft and unverified rules are never applied.**
- **The content decides too.**
  - SALEEM detects the sectors the content points to (caption, post text, speech, on-screen text). This is
    deterministic, whole-word keyword detection, with no model involved.
  - The rules of those sectors apply whatever sector was selected, so a wrong or convenient sector cannot hide
    applicable rules.
  - A mismatch is shown to the user: «اخترت قطاع … لكن محتوى الإعلان يشير أيضاً إلى …».
- **No exclusion through the API.** `promotions.selected_authorities` (D211) can no longer be written by any client
  (column privileges revoked, the constraint allows only null), and the analysis ignores it.
- **Read-only coverage per authority** (`analysis_runs.step_outputs.authorities`):

  | Status | Meaning |
  | --- | --- |
  | evaluated (منطبقة وفُحصت) | its verified rules were checked |
  | manual verification (تحتاج تحققاً يدوياً) | only document or reviewer checks apply |
  | not applicable (لا تنطبق) | no verified rule fits this ad's context |
  | insufficient verified coverage (تغطية معتمدة غير كافية) | no verified active rule yet; drafts are never applied |
  | unable to evaluate (تعذّر التقييم) | checks could not run on the media |

  Each row shows verified and draft rule counts and the rules with findings. Authorities that apply to the ad are
  marked, and those among them **without** verified rules are listed as an explicit gap: «لم تُفحص متطلباتها، فراجعها
  بنفسك».
- **Coverage today:** GMEDIA (10 verified rules), MC (1) and SDAIA (1). Every other authority shows insufficient
  coverage; the interface never implies complete coverage.

## Per-session individual demo (D215)

- **A fresh account per visit.** Each «ادخل مساحتي الشخصية التجريبية» creates a new short-lived account
  (`individual-<random>@demo.saleem.app`, a random password that never leaves the server). It gets a personal
  workspace flagged `is_demo` and expiring after 2 hours, seeded with copies of the template account's text sample
  ads.
- **Privacy:** visitors never see each other's uploads. RLS is per account, and the browser test confirms a second
  session cannot open the first session's ad.
- **The template** (`individual@demo.saleem.app`, created by the demo seed) is never signed into. demo-login refuses
  if it has any organisation membership or no demo workspace.
- **Shared AI protections are kept:**
  - demo workspaces count in the daily demo AI cap
  - at most `DEMO_MAX_PERSONAL_SESSIONS` (default 200) sessions can be active
  - the per-IP rate limit (`DEMO_RATE_PER_HOUR`) still applies
- **Purge:** 26 hours after expiry (so the 24-hour AI cap still counts the session), the session's uploaded files are
  deleted and the account is banned permanently.
  - Rows are **not** deleted, because `review_events` / `review_decisions` are an immutable audit log that also covers
    personal versions.
  - The banned account can never sign in again, and RLS keeps its rows unreadable by anyone else.
  - Deleting them would need a decision on audit immutability for demo data.

## Test isolation (D214)

- **Guard:** `backend/tests/helpers/db-guard.ts` is a vitest setup file. The run **fails immediately** if any database
  target in the environment (`SUPABASE_LOCAL_URL`, `SUPABASE_URL`, `TEST_SUPABASE_URL`) is not the isolated stack:
  `http://127.0.0.1:544xx` together with `SALEEM_ISO=1`.
- **No `.env` reading:** database settings come only from the process environment, never from `backend/.env`, which
  points at the development database.
- **No live mode:** the former «live» isolation mode (hosted URL + test-user credentials) is removed.
- **Running:**
  - database suites run only under `node scripts/isolated-stack.mjs run -- npm --workspace backend test`
  - a plain `npm test` skips them without connecting anywhere

## What else was built (D211)

- **Sign-in page:** sign-in beside «جرّب سَليم».
  - «الشركات والمؤسسات» shows the four main roles plus the five others on request, with their responsibilities.
  - «الأفراد وصنّاع المحتوى» opens the per-session demo.
  - No password reaches the browser.
- **Registration and onboarding:** sign-up asks for personal or organisation use (a preference only). `/welcome`
  creates the personal workspace, or leads to the existing organisation creation. Invitations are unchanged.
- **Personal dashboard** «مساحتي الشخصية»:
  - four actions: create (Studio), check, smart correction, Ask SALEEM
  - recent ads, results, drafts, recent corrections, saved videos and the monthly AI allowance
  - all read from the server
- **Navigation, library and settings:** personal navigation, the «إعلاناتي» library (filters, archive) and personal
  settings (display name).
- **Advertisement page** for personal ads:
  - the coverage table, re-check, and download with a warning for unresolved findings
  - findings show their authority, article reference, verification level, official source, evidence, timestamp and
    suggested fix
  - no enterprise review elements
- **Smart correction:** the existing SALEEM Fix, including the Studio replacement.
- **Ask SALEEM:** answers only from verified active rules and the user's own ads.
- **Allowances (personal, monthly):** analysis 30, script 20, correction 20, Ask 60. Generated media is 0 (no
  provider configured).
- **Landing page:** presents both audiences.
- **Rulebook:** the coverage panel, and the fix for drafts wrongly labelled «سارية ومطبقة».

## Migrations (rollbacks included)

- `20261122100000_v2_personal_workspaces` (D211)
- `20261122110000_v2_personal_sector_demo` (D213/D215):
  - `selected_authorities` locked to null and not writable by clients
  - the sector vocabulary gains healthcare, real_estate and general
  - `recommend_authorities` covers the new sectors
  - `personal_workspaces.expires_at` and `purged_at`

The development database has the first one only (applied with your approval on 2026-11-22). The second has been
applied only on the isolated stack.

## Manual testing (isolated stack, no AI request)

```bash
ISO_TEST_PROVIDER=1 node scripts/isolated-stack.mjs start      # deterministic test providers (D212)
node scripts/isolated-stack.mjs run -- npm run demo:seed       # creates the individual template and its sample ads
eval "$(npx supabase status --workdir "$(pwd)/.iso" -o env | grep -E '^(API_URL|ANON_KEY)=')"
cd frontend && VITE_SUPABASE_URL="$API_URL" VITE_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY" npx vite --port 3200
node scripts/personal-walkthrough.mjs --out <dir>              # the full journey, from the repo root
```

By hand:

1. Open `/login`, choose «الأفراد وصنّاع المحتوى», then enter. You get a new, private workspace.
2. Check an ad: upload a video, then choose a sector (try «محتوى عام» for a cosmetics ad).
3. Open the ad:
   - the coverage table: statuses, the SFDA gap, the sector mismatch
   - the findings with their authorities
   - smart correction, then comparison, re-check, and download (with the warning)

Screenshots: `docs/saleem-v2/screenshots/personal/`.

## Limitations

- **Verified coverage is narrow** (GMEDIA, MC, SDAIA). Other authorities need their rules legally reviewed and
  activated.
- **Sector detection** is keyword-based (Arabic and English). It can over-detect (for example «كريم» as a name), which
  only adds rules to check and never removes any.
- **Expired demo sessions** keep their text rows (unreadable, account banned) because the review audit is immutable.
- **Studio for individuals** has no reusable personal product library.
- **Workflow test in deterministic mode:** `backend/tests/workflows.test.ts` needs the default isolated mode. In
  deterministic mode, analyses complete with findings that then wait for reviewer responses.
