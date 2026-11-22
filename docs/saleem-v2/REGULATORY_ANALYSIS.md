# How SALEEM analyses an advertisement (D217)

One engine serves individuals and organisations. The account type changes the workflow after the analysis (download
vs human review and approval), never the regulatory scope.

## 1. What the user provides

Users never choose authorities, packs or rules.

| Input | Individuals | Organisations |
| --- | --- | --- |
| Content | Video, image, text or PDF | Video, image, text or PDF |
| Caption | Yes | Yes |
| Platform and channels | Yes | Yes |
| Paid status, AI use, Mawthooq licence | Yes | Yes |
| Context | Sector and publication context | Product (its sector), communication type and distribution |

## 2. What SALEEM extracts

- spoken audio (transcript with timestamps)
- on-screen text and video frames (OCR from the model)
- images and PDF pages
- the caption and post text
- claims and signals (discounts, contests, financial terms…)

## 3. Which rules apply

1. **Every supported authority is considered.** Every rule pack of GMEDIA, MC, SDAIA, SFDA, SAMA, CMA, IA, MT, REGA and
   MOHU is enabled, plus SALEEM's system checks.
2. **Only verified, active rules can apply.** Draft or pending rules (223 today) are never applied, whatever an
   organisation's old pack settings say (`org_rule_packs` no longer changes the scope).
3. **Applicability is decided by the context:**
   - the sector: the selected one **plus every sector detected in the content**, so a wrong sector cannot hide rules
   - channels, communication type, distribution, paid status and audience
   - content triggers
4. **Only the applicable rules are sent to the model**, never every rule in the database. Deterministic checks run
   alongside the model.
5. **Organisation overrides** may narrow only that organisation's own internal policies (INT-*), never a regulatory
   rule or a system check. Organisation policies supplement the regulations; they never override them.

## 4. What the report shows

**Regulatory coverage (every report):** one row per authority.

| Status | Meaning |
| --- | --- |
| evaluated | its verified rules were checked |
| manual verification | only document or reviewer checks apply |
| not applicable | no verified rule fits this ad's context |
| insufficient verified coverage | no verified active rule yet |
| unable to evaluate | checks could not run on the media |

Each row also shows:

- verified and draft rule counts
- applicable and evaluated rules
- violations and warnings, with the rule codes
- excluded rules and their reasons
- a "relevant to your ad" marker

Relevant authorities without verified rules are listed as a gap. A mismatch between the selected sector and the
content is shown too.

**Each finding:** the authority, the rule code, the article reference, the official source link, the evidence quote,
the timestamp, the explanation and the suggested correction.

## 5. Rulebook

`/rules` is public. It lists all 238 rules (15 active: 12 regulatory + 3 system checks; 223 drafts shown for
information) with:

- the source and its verification
- the article reference and description
- applicability and severity

Filters (authority, sector, status, severity) are for browsing only and never change an analysis.

## 6. Verified (isolated stack, deterministic providers, no AI request)

Six text advertisements were analysed as the individual demo and as an enterprise marketer. The results were identical
for both account types:

| Ad | Content sectors detected | Relevant authorities | Findings |
| --- | --- | --- | --- |
| Cosmetic | cosmetics | GMEDIA evaluated · MC evaluated · SFDA no verified rules | MAW-01, COM-01 |
| Banking | banking | GMEDIA evaluated · SAMA no verified rules | — |
| Investment | capital_market | GMEDIA evaluated · SAMA, CMA no verified rules | COM-01 |
| Tourism | tourism | GMEDIA evaluated · MC evaluated · MT no verified rules | MAW-01 |
| Sponsored creator | ecommerce (mismatch with «retail») | GMEDIA evaluated · MC evaluated | MAW-01, MAW-03, MAW-04 |
| Wrong sector («general content», banking text) | banking (mismatch reported) | GMEDIA, MC evaluated · SAMA no verified rules | MAW-01 |

**Bypass attempts:**

- Direct API writes to `org_rule_packs` and `org_rule_overrides` by the organisation admin were refused.
- With those rows planted in the database anyway, the analysis was unchanged: GMEDIA and MC "disabled", drafts opted
  in for SAMA and SFDA, COM-01 "disabled". All three authorities were still evaluated, COM-01 was still found, and no
  draft finding appeared.
- `promotions.selected_authorities` cannot be written by anyone (D213).

## Limitations

- **Verified coverage is narrow:** GMEDIA (10 rules), MC (1) and SDAIA (1). SAMA, CMA, SFDA, MT, REGA, IA and MOHU
  have no verified active rules yet. Their requirements are reported as gaps, never as compliance. Activating them
  needs legal verification.
- **Sector detection** is keyword-based, and it only adds rules.
- **Retired organisation settings:** the pack-settings and draft opt-in controls were removed from the rulebook. The
  `org_rule_packs` table remains, without effect.
