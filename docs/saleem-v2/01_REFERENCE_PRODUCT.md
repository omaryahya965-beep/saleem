# 01 — Reference product: what we learn from Adclear and competitors

This file translates public documentation of Adclear (UK, financial-promotions compliance) and four
competitors into **SALEEM decisions**. It describes capabilities and workflows only.

- **Do not** copy their code, wording, UI layout, colours, icons, names of screens, or brand.
- "Confirmed" = stated in the vendor's public docs (links at the end). "Recommendation" = our design
  choice for SALEEM, not a claim about the vendor.
- Vendor performance figures (e.g., accuracy or speed claims) are marketing statements without
  published methodology. Never reuse them in SALEEM copy.

---

## A. Core object model

**Confirmed (Adclear):** the unit is a *promotion*; it has immutable *versions* (V1 created with the
promotion; later versions are revisions); each version gets an asynchronous *evaluation* producing
*issues* (recommendation, rationale, severity, cited rules, location); humans then *review* with
decisions. Versions cannot be deleted or edited; a wrong upload is handled by archiving the promotion.

**SALEEM decision:** `promotions` + existing `submissions` as versions (`promotion_id`, `version_no`),
existing `analysis_runs` as evaluations, existing `findings` extended. Versions are immutable once
analysed; archive instead of delete.

## B. Creating a promotion

**Confirmed:** four upload types — *Single* (one asset, one decision), *Carousel* (several frames, one
decision for all), *Variations* (linked promotions sharing a core message, each decided separately; up to
20), *Batch* (unrelated items uploaded together, each decided separately). Inputs: file, pasted text
(minimum length before AI evaluation), website link captured as a screenshot, cloud-drive documents,
video-review tools, a design-tool plugin. Required fields: name, product, market/jurisdiction, channel,
deadline. Optional: published caption (evaluated), notes for the reviewer (not evaluated), paid
toggle, evergreen toggle, go-live/end dates, assigned reviewer, approval-flow preset (may be locked by
market). Batch/Variations are created as drafts. A *communication type* (e.g., financial promotion vs
internal communication) decides which rules, claims and disclaimers apply; it cannot change after
upload; for the default type the system first classifies whether the content is a financial promotion
and treats unclear cases as one; if no rule applies the evaluation fails with an explicit message.
Published API limits: images 50 MB, PDF 30 MB, DOCX/XLSX 10 MB, video/audio 2 GB.

**SALEEM decision:**
- P0/P1: Single (video, image, text; PDF in Phase 4). Required context: product (or "none" for
  non-product ads), channel(s), communication type, audience, market (default SA), deadline (org mode).
  Optional: caption (evaluated), reviewer notes (not evaluated), paid, distribution
  (owned/paid media/influencer) and, for influencers, the creator's Mawthooq licence number.
- Classification step "is this an advertisement?" with override «اعتباره إعلاناً» for authorised users.
- If no rule applies → `rule_checks` show `not_applicable` for all and the UI says «لا توجد قواعد
  منطبقة على هذا السياق» — never "no findings".
- P2: Carousel (one decision), Variations (grouped promotions), Batch (verify the existing `batches`
  feature first). P3: URL capture and design-tool integrations.
- Keep SALEEM's existing limits (`lib/media.ts`); document them in the UI.

## C. Automated review

**Confirmed:** evaluation runs after creation and before submission; progress states
(evaluating/syncing/complete/failed) with retry; outcomes: issues to review, no modifications required,
or "not a financial promotion". Each issue explains reasoning and cites the source rule. Rules apply by
trigger (product, channel, jurisdiction, communication/content type, targeting); the vendor does **not**
record a pass/fail for every rule in scope. Evaluations typically take tens of seconds and are fetched by
webhook or polling.

**SALEEM decision (deliberate improvement):** record a `rule_checks` row for **every** applicable rule
(passed / failed / not_applicable / unable_to_verify) plus a per-run **coverage** report. This is how
SALEEM proves what was and was not checked, and it powers precision/recall and rule-applicability
metrics.

## D. Responding to AI findings (the learning loop)

**Confirmed:** uploader actions — agree and will action; dispute; reply. Reviewer actions — agree and
require action; relevant but not required here (approvable as-is, the exception is learned); dismiss
(the AI was wrong). Uploaders must respond to every comment before resubmitting; reviewers are asked to
respond to every AI comment before deciding. When uploader and reviewer disagree, the reviewer wins; an
uploader dispute alone does not change future behaviour for regulatory comments. Written reasoning is
more valuable than a click. Users can flag missed issues by pinning a comment and tagging support.

**SALEEM decision:** extend `finding_feedback` with `action`, `actor_role`, `comment`. Require a comment
for `dispute`, `not_required`, `dismiss`. Gate submission/decision on responses via `org_settings`.
Store everything for the calibration report (Phase 7). Never auto-change rules from feedback; a human
edits rules.

## E. Asset viewer and comments

**Confirmed:** zoom (up to 800%), fit width/page, PDF page thumbnails and in-document search; comments
anchored to highlighted text, a point on an image, a PDF page point, or a video timestamp; a "locate"
action jumps to the anchor; unsent comments are kept as drafts; mentions notify colleagues;
collaborators receive decision updates. On a new version: AI findings still present are carried forward
and re-checked; open reviewer requests are carried forward and marked resolved when fixed; general
discussion stays on its original version; resolved/deleted comments are not carried; carried items show
the version they came from; replies from older versions are read-only.

**SALEEM decision:** one `AssetViewer` with typed anchors (`image {x,y}` ratios, `video {t}`,
`text {start,end,quote}`, `pdf {page,x,y}`), building on the existing `VideoTimeline`. `comments` table
with threads, mentions, kinds (`general`, `change_request`, `decision_note`, `system`) and carry-forward
rules identical in spirit. Draft comments in `localStorage` (wrapped in try/catch).

## F. Review decisions, approval flows, escalation

**Confirmed:** decisions — approve, conditionally approve (a recorded condition to be met in the next
version), reject, request changes; structured, configurable rejection/change reasons (multi-select,
"other" with text) stored on the item and in its thread. Statuses: draft, pending review, in review,
approved, conditionally approved, rejected, changes needed, escalated (needs the feature), reviewing
risk and risk accepted (needs the feature). Escalation: the assigned reviewer sends the item to a Legal
user, who replies with a comment and never decides; the item returns to the reviewer. Risk acceptance:
an uploader with a special permission can accept the risk on a rejected/changes-needed item; this is
not an approval. Multi-level approval: admin-defined presets, sequential or parallel, steps by role,
team or named external reviewer; a person cannot review two steps; a market can force a preset; reject
or request-changes at any step stops the flow; on resubmission the submitter chooses which approved
steps to carry forward; editing a live flow discards affected decisions. Self-approval (add-on): rules by
channel, product, market, people and an AI requirement (nothing / all AI comments answered / no
modifications required), re-checked at click time; uploaders cannot conditionally approve their own
work. Evergreen: approving an evergreen item requires a next review date; it returns to the queue when
due. Lifecycle dates: published, taken down, recalled with reason.

**SALEEM decision:** P1 — single-reviewer decisions with reasons, conditional approval, escalation to
`legal`, separation of duties, immutable hash-chained decisions. P2 — multi-level presets, risk
acceptance, evergreen, lifecycle/withdrawal (SAMA Art. 17 allows SAMA to require withdrawal within one
business day: model a withdrawal request with a deadline). P3 — self-approval with the strictest default
(no findings at all).

## G. Rules, policies, disclaimers

**Confirmed:** a rule = *Trigger* (when it applies) + *Check* (what it looks for) + *Source* (policy,
regulation or internal standard). Scope fields: product, channel, jurisdiction, content type,
communication type, targeting exclusions. Customers see summaries, scope, tags, linked items and a
changelog; they can change name/scope (new version + mandatory reason), archive/restore (reason), and
tags; they cannot see or change the detailed check logic — the vendor manages it and improves rules from
reviewer feedback (changelog labels: created, AI improvement, scope change, archived/restored). Rules can
be shared across workspaces read-only. Policies are uploaded documents/URLs with a next review date and
reminders; rules derive from them. Disclaimers are approved reusable texts scoped by product, channel,
jurisdiction and communication type, versioned, linked to rules and claims, with an optional
"prominence" check (too small relative to main text).

**SALEEM decision:** same three-part model, but **SALEEM shows the check logic** (summary, applicability
JSON in readable form, check type, the deterministic function name, the model instruction) to compliance
admins — transparency is a selling point for Saudi compliance teams. Platform admins own global packs;
org admins can enable/disable packs, include draft rules for preview, and narrow scope (with reason).
Disclaimers in Phase 5 with presence check; prominence as a low-confidence model judgement.

## H. Claims library

**Confirmed (add-on):** claims have name, content, jurisdictions, products, substantiation (files/URLs),
disclaimers and a next review date; they go through the same review workflow; only approved claims can be
linked; versions keep history. Evaluation checks statements against approved claims for the promotion's
products, markets and communication type and raises: not in the library; matching claim not approved;
similar but not identical wording, not approved; claim does not cover this promotion's scope. Some
gaps need the promotion to change (wording differs from an approved claim; claim archived/expired).
Reviewers can fix library gaps from the finding itself (review/approve the claim, compare and approve a
similar claim, extend the claim's scope as a new version, add the statement to the library with at least
one substantiation). One fix resolves every finding on the promotion pointing to that claim; resolved
findings stay resolved.

**SALEEM decision:** Phase 5, same four classes plus **number mismatch** (Arabic/Western digits
normalised). Matching = Arabic normalisation → exact → trigram similarity (`pg_trgm`) → numeric
comparison; the model only proposes candidate claim spans. Fix actions are RPCs with permission checks.

## I. External partners

**Confirmed:** a public submission link per organisation (no account needed to submit; one promotion at a
time; terms acceptance; the link only grants submitting). First submission creates an external member
and an invitation; partners sign in by email code and see only their own submissions ("My Submissions":
status, deadline, decision, comments unless hidden by the org). Multi-workspace orgs approve workspace
access for new partners. External reviewers see only promotions explicitly assigned to them, within
their markets; they cannot reassign or edit flows.

**SALEEM decision:** Phase 6. Evolve today's `share_links`/`share_reviews` (brand review) into: (1)
partner submission link + `external_uploader` role; (2) `external_reviewer` named assignment. Keep the
current brand share link working.

## J. Analytics

**Confirmed definitions:** promotions submitted (excludes drafts); versions submitted; average versions
per promotion (min 1.0); early requests (deadline shorter than SLA); SLA compliance (reviewed within the
SLA in business days, date-level; 0% if nothing reviewed); first-time approval (approved on first review;
created in range, approval may be later); approval time (first submission → first approval, mean and
median); first response time (submission → any reviewer response); number of iterations (resubmissions
before approval; first-time = 0); most active uploaders/reviewers (top 5; decision date); breakdowns by
status, product, ad type; rejection and change-request reasons (each reason counts). Filters: product, ad
type, country, uploader, reviewer, promotion, tags, evergreen. Export to spreadsheet with status history.

**SALEEM decision:** Phase 6, computed only from `review_events`/`review_decisions` with formulas in
`phases/phase-6-enterprise.md`. Saudi business week (Sunday–Thursday) for SLA.

## K. Roles

**Confirmed:** seven roles — compliance admin, compliance, marketing admin, marketing, legal, external
uploader, external reviewer; risk acceptance is an extra permission; review rights are scoped by market.

**SALEEM decision:** map onto existing `org_members` roles: `owner`, `admin` (compliance admin),
`reviewer` (compliance), `creator` (marketing) + new `legal`; external roles in Phase 6; review scope by
product type/channel optional in Phase 6.

## L. Integrations and assistant

**Confirmed:** public REST API (resumable file upload service; promotions, versions, evaluation,
comments import/update with idempotency keys, decisions, reviewer assignment; webhooks for evaluation
completed, comment created, review submitted/approved/changes requested/rejected; 60 requests per
minute per key), MCP connection for AI assistants, Slack and email alerts, a read-only in-app assistant
that answers questions about rules, promotions, comments and dashboards within the user's permissions.

**SALEEM decision:** P3. API keys hashed at rest, per-org scope, webhooks signed (HMAC) with retries.
Assistant read-only, executed with the user's JWT so RLS applies.

---

## M. What the competitors add

| Vendor | Idea worth adopting | SALEEM decision |
|---|---|---|
| PerformLine (pre-publication scanner) | 0–100 score mapped to pass/warning/fail with client thresholds; each finding has violation type, snippet, regulatory basis, severity, plain explanation and a suggested rewrite; disclosure size/prominence/placement checks; findings assigned to owners | A **risk band** for triage only (never a "compliance %"); full finding anatomy; disclosure checks; assignment of change requests in Phase 4 |
| Saifr (SaifrReview) | Clear financial risk categories (promissory/exaggerated language, comparisons and rankings, performance claims, testimonials, tax-free claims); separate "suggested language" model; readability score; human experts validate model outputs; responsibility stays with the customer | Arabic risk taxonomy in the model prompt; separate "suggested fix" field generated after detection; optional Arabic readability hint (P3); the same responsibility statement in SALEEM copy |
| Blee | Pre-read flags that marketing fixes before legal sees the item; rules built with each customer by legal engineers and refined with feedback; every draft and decision logged | "Self-check before submit" is SALEEM's default flow; Saudi rules are drafted by us and **activated only after legal review** |
| Veeva PromoMats | System of record for the full lifecycle, publish and withdraw approved assets, modular pre-approved content, MLR review | `withdrawn` state with reason; claims + disclaimers as reusable approved blocks |
| IntelligenceBank | Brand-guideline checks, disclaimer management, linking people in assets to talent-release consent, proofing/markup, full audit trail | Brand-guideline pack (P2); "consent record attached" for people/testimonials (SAMA Art. 9) — **without** face recognition |

## N. Where SALEEM is already ahead (keep and highlight)

- Arabic-first analysis: Saudi-dialect transcription filtering, Arabic normalisation, deterministic Arabic
  checks.
- Sealed compliance log with public verification (`/verify/$id`).
- Privacy by default: evidence frames blurred server-side; media deleted after 24 h for creators.
- Resumable, heartbeat-protected pipeline with cost tracking and an eval runner.

## O. Public sources consulted (Nov 2026)

- Adclear docs index: https://docs.adclear.ai/llms.txt
- Feature catalog: https://docs.adclear.ai/feature-catalog
- Upload types: https://docs.adclear.ai/upload-types
- Submitting for review: https://docs.adclear.ai/marketing/submitting-for-review
- Promotion statuses: https://docs.adclear.ai/promotion-statuses
- Multi-level approval: https://docs.adclear.ai/multi-level-approval
- Comments and collaboration: https://docs.adclear.ai/marketing/comments-collaboration
- Versions: https://docs.adclear.ai/marketing/versions
- Rules: https://docs.adclear.ai/compliance/rules.md and https://docs.adclear.ai/rule-visibility
- Policies and disclaimers: https://docs.adclear.ai/compliance/policies.md
- Communication types: https://docs.adclear.ai/communication-types
- Self-approval: https://docs.adclear.ai/self-approval
- External submission form: https://docs.adclear.ai/external-submission-form
- External reviewer: https://docs.adclear.ai/external-reviewer.md
- Metrics: https://docs.adclear.ai/metrics
- Settings: https://docs.adclear.ai/settings · Roles: https://docs.adclear.ai/how-roles-work.md
- Helping the AI learn: https://docs.adclear.ai/how-you-help-adclear-learn
- Review decisions: https://docs.adclear.ai/compliance/review-decisions.md
- Escalations: https://docs.adclear.ai/compliance/escalations.md
- Claims and claim findings: https://docs.adclear.ai/marketing/claims.md, https://docs.adclear.ai/compliance/claim-findings.md
- Developer docs: https://docs.adclear.ai/developer/introduction, https://docs.adclear.ai/developer/evaluation.md, https://docs.adclear.ai/developer/comments.md
- Product pages: https://www.adclear.ai/product, https://www.adclear.ai/product/pre-publication-approvals
- PerformLine: https://performline.com/products/pre-publication/
- Saifr: https://saifr.ai/saifrreview, https://saifr.ai/faqs
- Blee: https://www.blee.com/
- Veeva PromoMats: https://www.veeva.com/products/veeva-promomats/
- IntelligenceBank: https://intelligencebank.com/

Not verifiable without a vendor account: exact screen layouts, internal check logic, default rejection
reasons, version-comparison UI, how feedback updates models. Do not invent them; design SALEEM's own.
