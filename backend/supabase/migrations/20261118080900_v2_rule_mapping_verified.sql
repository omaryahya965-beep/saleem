-- v2: SAMA/CMA mapping VERIFIED against the official texts (read 2026-11-18). Additive. Changes NO rule status and
-- decides nothing: every row stays status 'pending' until the user / legal reviewer approves.
--   SAMA: «Rules for Advertising Products and Services Provided by Financial Institutions», Circular 44064343,
--         13/8/1444H (5/3/2023G), In-Force — https://rulebook.sama.gov.sa/en/node/1715 (Arts 1–17, 3.1–3.9, 5.1–5.8).
--   CMA:  Capital Market Institutions Regulations (Board Resolution 1-83-2005, as amended 1447H), official English
--         translation — Art 33 (a)–(g), Art 35, Annex 5.1 items 1–19.
-- The automatic classifier (gen-rule-mapping.mjs) matched by citation; reading the texts corrected 9 CMA pairs.
alter table public.rule_mappings add column if not exists verified_classification text null
  check (verified_classification in ('exact_match', 'verified_equivalent', 'possible_match', 'no_match', 'superseded_by_official'));
alter table public.rule_mappings add column if not exists official_evidence text null;
alter table public.rule_mappings add column if not exists verified_against text null;
alter table public.rule_mappings add column if not exists verified_on date null;

-- Pairs the citation matcher missed (found by reading the official text).
insert into public.rule_mappings (old_code, new_code, classification, similarity) values
  ('CMA-CMI-33-BENEFIT', 'SA-CMA-003', 'possible_match', null),
  ('CMA-CMI-A51-PAST', 'SA-CMA-020', 'possible_match', null),
  ('CMA-CMI-A51-RISK', 'SA-CMA-025', 'possible_match', null),
  ('CMA-CMI-A51-RISK', 'SA-CMA-029', 'possible_match', null),
  ('CMA-CMI-A51-RISK', 'SA-CMA-031', 'possible_match', null)
on conflict (old_code, new_code) do nothing;

create temporary table _v (old_code text, new_code text, cls text, ev text) on commit drop;
insert into _v values
-- SAMA: each pair cites the same official paragraph and both state its requirement.
  ('SAMA-ADV-01', 'SA-BANK-001', 'verified_equivalent', 'SAMA Art 1: no tempting/misleading methods, no exaggerated benefits.'),
  ('SAMA-ADV-01', 'SA-BANK-002', 'verified_equivalent', 'SAMA Art 1: clear terms and numbers (clarity part of Art 1).'),
  ('SAMA-ADV-02', 'SA-BANK-003', 'verified_equivalent', 'SAMA Art 2: Arabic, unless aimed at non-Arabic speakers.'),
  ('SAMA-ADV-03-1', 'SA-BANK-004', 'verified_equivalent', 'SAMA 3.1: institution name, logo and contact information.'),
  ('SAMA-ADV-03-2', 'SA-BANK-005', 'verified_equivalent', 'SAMA 3.2: name of the product or service.'),
  ('SAMA-ADV-03-3', 'SA-BANK-006', 'verified_equivalent', 'SAMA 3.3: conditions and main provisions.'),
  ('SAMA-ADV-03-4', 'SA-BANK-007', 'verified_equivalent', 'SAMA 3.4: target customer/consumer.'),
  ('SAMA-ADV-03-5', 'SA-BANK-008', 'verified_equivalent', 'SAMA 3.5: all fees and commissions incl. VAT.'),
  ('SAMA-ADV-03-5', 'SA-BANK-009', 'verified_equivalent', 'SAMA 3.5 (insurance part): state whether the price includes all fees.'),
  ('SAMA-ADV-03-6', 'SA-BANK-010', 'verified_equivalent', 'SAMA 3.6: minimum transactions/requirements, if any.'),
  ('SAMA-ADV-03-7', 'SA-BANK-011', 'verified_equivalent', 'SAMA 3.7: explanation of icons/abbreviations.'),
  ('SAMA-ADV-03-8', 'SA-BANK-012', 'verified_equivalent', 'SAMA 3.8: finance products state APR and term.'),
  ('SAMA-ADV-03-8', 'SA-BANK-013', 'verified_equivalent', 'SAMA 3.8: no other term-cost rates.'),
  ('SAMA-ADV-03-8', 'SA-BANK-014', 'verified_equivalent', 'SAMA 3.8: real-estate finance states fixed or variable term cost.'),
  ('SAMA-ADV-03-9', 'SA-BANK-015', 'verified_equivalent', 'SAMA 3.9: statement of SAMA supervision and control.'),
  ('SAMA-ADV-04', 'SA-BANK-016', 'verified_equivalent', 'SAMA Art 4: how to benefit, start and end dates.'),
  ('SAMA-ADV-05-1', 'SA-BANK-017', 'verified_equivalent', 'SAMA 5.1: no false or misleading claims.'),
  ('SAMA-ADV-05-2', 'SA-BANK-018', 'verified_equivalent', 'SAMA 5.2: no IP infringement or fake trademarks.'),
  ('SAMA-ADV-05-3', 'SA-BANK-019', 'verified_equivalent', 'SAMA 5.3: no use of SAMA name or logo.'),
  ('SAMA-ADV-05-4', 'SA-BANK-020', 'verified_equivalent', 'SAMA 5.4: no confusion with other products/names.'),
  ('SAMA-ADV-05-5', 'SA-BANK-021', 'verified_equivalent', 'SAMA 5.5 + 5.6: public order/morals; incitement, discrimination, extremism (both rules combine the two).'),
  ('SAMA-ADV-05-8', 'SA-BANK-023', 'verified_equivalent', 'SAMA 5.8: banknote/coin images need a non-objection letter.'),
  ('SAMA-ADV-06', 'SA-BANK-024', 'verified_equivalent', 'SAMA Art 6: legible FX-rate warning.'),
  ('SAMA-ADV-07', 'SA-BANK-025', 'verified_equivalent', 'SAMA Art 7: free offers explicit with target group.'),
  ('SAMA-ADV-08', 'SA-BANK-026', 'verified_equivalent', 'SAMA Art 8: sector reputation, other institutions, fair competition.'),
  ('SAMA-ADV-09', 'SA-BANK-027', 'verified_equivalent', 'SAMA Art 9: written consent for personal data.'),
  ('SAMA-ADV-10', 'SA-BANK-028', 'verified_equivalent', 'SAMA Art 10: unsuitable insurance/credit ads to under-18s.'),
  ('SAMA-ADV-11', 'SA-BANK-029', 'verified_equivalent', 'SAMA Art 11: consent per channel and easy permanent opt-out.'),
  ('SAMA-ADV-12', 'SA-BANK-030', 'verified_equivalent', 'SAMA Art 12: ad offers binding and included in the contract.'),
  ('SAMA-ADV-13', 'SA-BANK-031', 'verified_equivalent', 'SAMA Art 13: official channels or licensed third parties.'),
  ('SAMA-ADV-14', 'SA-BANK-032', 'verified_equivalent', 'SAMA Art 14: advertising policy updated at least every 3 years.'),
  ('SAMA-ADV-15', 'SA-BANK-033', 'verified_equivalent', 'SAMA Art 15: written compliance approval before publication.'),
  ('SAMA-ADV-17', 'SA-BANK-034', 'verified_equivalent', 'SAMA Art 17: withdrawal within one business day of notice.'),
-- CMA, verified against the CMI Regulations text.
  ('CMA-CMI-33-APPROVAL', 'SA-CMA-001', 'verified_equivalent', 'CMI 33(b)(1): approval by a designated officer (old rule also covers 33(f)).'),
  ('CMA-CMI-33-APPROVAL', 'SA-CMA-006', 'verified_equivalent', 'CMI 33(f): complete record of each approved advertisement (bundled in the old rule).'),
  ('CMA-CMI-33-APPROVAL', 'SA-CMA-005', 'no_match', 'CMI 33(e) is withdrawal on non-compliance; the old rule is approval/records.'),
  ('CMA-CMI-33-BENEFIT', 'SA-CMA-003', 'verified_equivalent', 'CMI 33(b)(3) and Annex 5.1 item 12: disclose benefits received by the communicator.'),
  ('CMA-CMI-33-BENEFIT', 'SA-CMA-001', 'no_match', 'CMI 33(b)(1) is approval, not benefit disclosure.'),
  ('CMA-CMI-33-BENEFIT', 'SA-CMA-002', 'no_match', 'CMI 33(b)(2) is clear/fair/not misleading.'),
  ('CMA-CMI-33-BENEFIT', 'SA-CMA-005', 'no_match', 'CMI 33(e) is withdrawal.'),
  ('CMA-CMI-33-FAIR', 'SA-CMA-002', 'verified_equivalent', 'CMI 33(b)(2): clear, fair and not misleading.'),
  ('CMA-CMI-33-FAIR', 'SA-CMA-001', 'no_match', 'CMI 33(b)(1) is approval.'),
  ('CMA-CMI-33-FAIR', 'SA-CMA-005', 'no_match', 'CMI 33(e) is withdrawal.'),
  ('CMA-CMI-35-RETAIL', 'SA-CMA-010', 'superseded_by_official', 'CMI Art 35: no non-retail/derivatives ads to a retail client UNLESS the institution has determined suitability. The old rule states an absolute ban (omits the exception); SA-CMA-010 matches the official text.'),
  ('CMA-CMI-A51-PAST', 'SA-CMA-020', 'verified_equivalent', 'Annex 5.1 item 9 (1),(2),(4): fair, not selected to exaggerate, verifiable.'),
  ('CMA-CMI-A51-PAST', 'SA-CMA-021', 'verified_equivalent', 'Annex 5.1 item 9 (3): state the source.'),
  ('CMA-CMI-A51-PAST', 'SA-CMA-022', 'verified_equivalent', 'Annex 5.1 item 9 (5): warn past performance is not a guide.'),
  ('CMA-CMI-A51-PAST', 'SA-CMA-031', 'no_match', 'Annex 5.1 item 19 is sales charges and fees, not past performance.'),
  ('CMA-CMI-A51-RISK', 'SA-CMA-025', 'verified_equivalent', 'Annex 5.1 item 13: prices/values/income may fall.'),
  ('CMA-CMI-A51-RISK', 'SA-CMA-029', 'verified_equivalent', 'Annex 5.1 item 17: foreign-currency warning.'),
  ('CMA-CMI-A51-RISK', 'SA-CMA-030', 'verified_equivalent', 'Annex 5.1 item 18: illiquid securities.'),
  ('CMA-CMI-A51-RISK', 'SA-CMA-031', 'verified_equivalent', 'Annex 5.1 item 19: charges and performance fees.'),
  ('CMA-CMI-A51-RISK', 'SA-CMA-014', 'no_match', 'Annex 5.1 item 3 (no future-price forecast) is not a risk warning.'),
  ('CMA-CMI-A51-RISK', 'SA-CMA-015', 'no_match', 'Annex 5.1 item 4 (no false statements) is not a risk warning.');

update public.rule_mappings m set
  verified_classification = v.cls, official_evidence = v.ev, verified_on = date '2026-11-18',
  verified_against = case when m.old_code like 'SAMA%' then 'https://rulebook.sama.gov.sa/en/node/1715'
                          else 'https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf' end
from _v v where v.old_code = m.old_code and v.new_code = m.new_code;

-- Duplicate guard follows the VERIFIED mapping: a new draft stays out of analyses only when it duplicates an old rule
-- (verified_equivalent) or would replace one (superseded_by_official) — until a person decides.
update public.rules r set possible_duplicate_of = null
where r.rulebook_version_id = '22222222-2222-2222-2222-222222222222' and r.review_state = 'draft' and r.possible_duplicate_of is not null
  and not exists (select 1 from public.rule_mappings m where m.new_code = r.code and m.verified_classification in ('verified_equivalent', 'superseded_by_official'));
update public.rules r set possible_duplicate_of = m.old_code
from (select distinct on (new_code) new_code, old_code from public.rule_mappings
      where verified_classification in ('verified_equivalent', 'superseded_by_official') order by new_code, old_code) m
where r.code = m.new_code and r.rulebook_version_id = '22222222-2222-2222-2222-222222222222' and r.review_state = 'draft';
