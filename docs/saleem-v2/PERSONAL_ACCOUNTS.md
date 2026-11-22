# Personal accounts and regulatory authority selection (D211–D212)

SALEEM now serves two audiences with two different experiences:

| | Individuals and content creators | Companies and organisations |
| --- | --- | --- |
| Workspace | A **personal workspace** (`personal_workspaces`): the user's own advertisements (`promotions.org_id is null`, `owner_id = user`) | An organisation (`organizations`, `org_members`) |
| Roles | None. It is not a tenth role | The nine organisation roles, unchanged |
| Workflow | Draft → content → automated analysis → correction → re-analysis → download | Create → check → correct → collaborate → review → approve |
| Human approval | None, and none can be produced (every review/approval RPC refuses a personal advertisement) | Required, by an authorised person |
| Regulators | Chosen per advertisement (automatic recommendation or manual selection) | The organisation's rule-pack settings |

One user can have both a personal workspace and organisation memberships. The account menu switches between them,
and switching drops cached data so nothing from one workspace shows in the other.

## What was built

- **Sign-in page** (`/login`): sign-in for existing users beside «جرّب سَليم», with two audiences.
  - «الشركات والمؤسسات» shows the four main roles (organisation admin, marketer, compliance reviewer, external
    partner), plus the five other roles on request, each with its responsibilities.
  - «الأفراد وصنّاع المحتوى» opens the individual demo.
  - Sessions come from the existing `demo-login` broker, so no password reaches the browser.
- **Individual demo** (`individual@demo.saleem.app`, demo-login persona `individual`):
  - a personal workspace flagged `is_demo`, and **no** organisation membership (demo-login refuses it otherwise)
  - shares the demo AI cap with the enterprise sandbox
- **Registration and onboarding**:
  - Sign-up asks for «استخدام شخصي» or «شركة أو مؤسسة», stored as a preference only.
  - `/welcome` creates the personal workspace (`ensure_personal_workspace`: never an organisation, membership or
    role), or sends the user to the existing «create an organisation» page. Invitations are unchanged.
  - A signed-in user with neither workspace is sent to `/welcome`.
- **Personal dashboard** «مساحتي الشخصية»:
  - four actions: create with AI (Studio), check an ad, smart correction, Ask SALEEM
  - recent ads, check results, drafts, recent corrections, saved videos, and the monthly AI allowance
  - all read from the server; no hard-coded figures
- **Personal navigation**: الرئيسية، إعلاناتي، إعلان جديد، استوديو سَليم، دليل القواعد، اسأل سَليم، الإعدادات الشخصية.
  There are no enterprise pages, and the route guard refuses them by URL too.
- **Checking an ad** (`/new`, step «السياق والنشر»):
  - fields: sector, publication context (own product / sponsored by someone else / unpaid personal content), and the
    regulatory authorities
  - authorities can be **automatic** (`recommend_authorities`, the same function the analysis uses) or **manual**
    (one or more)
  - each authority shows its verified coverage: «N قاعدة معتمدة», «مسودات فقط — لا تُطبّق» or «لا تغطية بعد»
  - leaving out a recommended authority shows a warning, and choosing an authority without verified rules explains
    that no findings does not mean compliance
  - no organisation, campaign, reviewer, deadline or product is asked for
- **Analysis**: a personal advertisement is checked against the packs of its selected (or recommended) authorities.
  Draft rules are **never** applied. The run records `step_outputs.authorities`: mode, selected, recommended,
  excluded-recommended and packs.
- **Advertisement page**:
  - a personal badge instead of a human review status
  - the authorities checked, with «change and re-check» and a warning for left-out authorities
  - re-check
  - download, with a dialog listing unresolved findings first
  - an advisory notice
  - each finding shows its **authority**, article reference, verification level, official source and rule link
  - no comments tab, reviewer slots, company-rules section, lifecycle or claim linking
- **Smart correction**: the existing SALEEM Fix, unchanged (`can_fix_promotion` already allows the owner of a personal
  advertisement), including the Studio replacement.
- **Library** «إعلاناتي»: filters (needs fixes / no findings / not checked / archived), search, open, smart correction,
  archive (`archive_promotion` allows a personal owner). Versions and original media are always kept.
- **Rulebook**: a coverage panel per authority (click to filter). It also fixes a bug: drafts were labelled «سارية
  ومطبقة» because every rule row has `is_active = true`; only `review_state = 'active'` counts now.
- **Ask SALEEM (personal)**: answers only from verified active rules and the user's own personal advertisements, with
  example questions. A model answer counts against the personal «ask» allowance and the demo cap.
- **Allowances (personal, monthly)**:
  - analysis 30, script 20, text correction 20, Ask 60
  - generated image/video 0 (no provider configured)
  - local voice and video assembly are free
  - demo users also share the daily demo cap (now counting individual-demo analyses, corrections, Studio scripts and
    Ask)
- **Landing page**: an «لمن سَليم؟» section with the individual (create · check · correct · download) and company
  (create · check · correct · collaborate · review · approve) paths and their calls to action. The hero addresses both
  audiences.

## Data model and security (migration `20261122100000_v2_personal_workspaces`, rollback included)

- **`personal_workspaces`**: RLS lets a user read only their own row. Writes go only through
  `ensure_personal_workspace` and `save_personal_preferences`. `is_demo` is service-role only. Existing users with no
  membership, or with personal content, were backfilled.
- **`promotions.selected_authorities`**: a check constraint allows valid authorities only, **and only when `org_id` is
  null**.
- **`recommend_authorities(...)`**: a deterministic SQL function. **`authority_coverage()`** returns public coverage
  per authority.
- **`ai_allowance`**: personal limits, plus `ask` as a capability. `personal_ai_allowances()` returns the user's own.
- **`is_demo_sandbox_user` / `demo_ai_runs_today`**: now include the individual demo.

pgTAP `p16_personal_workspaces.test.sql` proves:

- a user sees only their own workspace, and personal use grants no membership
- `is_demo` cannot be set by a client
- another personal user and an organisation reviewer cannot read a personal advertisement
- every review/approval RPC leaves a personal advertisement in `draft`, with no reviewer
- `review_status` cannot be written by a client
- authority selection is refused on organisation advertisements
- an enterprise demo persona cannot open a personal workspace
- the allowances and the coverage are correct

## Test-only deterministic providers (D212)

- **Switch:** `SALEEM_TEST_PROVIDER=deterministic` makes transcription and the model step return empty, valid results
  with no network call, so only the deterministic rule engine produces findings.
- **Labelling:** runs are recorded as `deterministic-test`.
- **Safety:** refused when `SUPABASE_URL` is a hosted `supabase.co` project.
- **Enabling:** `ISO_TEST_PROVIDER=1 node scripts/isolated-stack.mjs start` turns it on for the isolated stack only.
- **Production:** never set this secret.

## Manual testing (isolated stack)

```bash
ISO_TEST_PROVIDER=1 node scripts/isolated-stack.mjs start     # deterministic analyses, no AI request
node scripts/isolated-stack.mjs run -- npm run demo:seed       # creates the individual demo and two personal ads
eval "$(npx supabase status --workdir "$(pwd)/.iso" -o env | grep -E '^(API_URL|ANON_KEY)=')"
cd frontend && VITE_SUPABASE_URL="$API_URL" VITE_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY" npx vite --port 3200
node scripts/personal-walkthrough.mjs --out <dir>              # the full journey with screenshots (from the repo root)
```

By hand:

1. Open `/login`, choose «الأفراد وصنّاع المحتوى», then «ادخل مساحتي الشخصية التجريبية».
2. «افحص إعلانك»: upload a video. In step 3, choose a sector and publication context, then try both automatic and
   manual authorities.
3. Open the advertisement:
   - check the findings' authorities
   - «غيّر الجهات وأعد الفحص»
   - «الإصلاح الذكي» → «تصحيح الفيديو» → render → accept, which creates a new version
   - the comparison tab
   - «نزّل الإعلان», which shows the warning first
4. «إعلاناتي», «دليل القواعد» (coverage), «اسأل سَليم» (examples).
5. Sign up a new user with «استخدام شخصي», then `/welcome`, which leads to an empty personal workspace.

Screenshots: `docs/saleem-v2/screenshots/personal/`.

## Limitations

- **Verified coverage is narrow.** Today only GMEDIA (10 rules), MC (1) and SDAIA (1) have verified active rules.
  SFDA, SAMA, CMA, MT, REGA and others are drafts and are not applied. The UI says so wherever an authority is chosen.
- **Studio for individuals** is the existing Studio. Product facts are entered per ad; there is no reusable personal
  product library yet.
- **Personal activity tab** reuses the version history panel. It shows versions and analyses (personal advertisements
  have no review events).
- **The shared individual demo** is one account: visitors can see each other's demo ads, as with the enterprise
  sandbox. Sessions end after two hours.
- **Workflow test in deterministic mode:** `backend/tests/workflows.test.ts` needs the default isolated mode. In
  deterministic mode analyses complete with findings, and the approval then waits for reviewer responses.
