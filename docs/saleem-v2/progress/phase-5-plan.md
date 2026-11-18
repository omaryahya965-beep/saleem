# Phase 5 plan — Claims, disclaimers, product facts, dashboard

## Discovery
- Matching needs the same Arabic normalisation as the rule engine (`normalizeArabic`, `extractNumbers`), so it runs in
  TypeScript in `analyze` (`_shared/claims/match.ts`) with a trigram similarity; `pg_trgm` is not needed (D119).
- Schema v2 is strict: `claims_detected` becomes a required array; v2 outputs without it still validate (empty).
- System rules `SYS-CLAIMS` and `SYS-DISCLAIMERS` join the 2026.11-v2 release (pack `sa-system`, active, internal).
- Notifications kind check widened again for `claim_review_due`.

## Slices
1. M8: claims (+ normalisation trigger), promotion_claims, disclaimers (+ two platform templates marked «صيغة مقترحة —
   راجعها قانونياً»), saved_views, org_rule_overrides, `evidence` bucket + storage RLS, RPCs (save/submit/review/
   archive/link claims, fix from finding, extend scope, disclaimers, overrides, saved views), reminders cron. pgTAP.
2. Engine: claims matcher (six classes), disclaimer presence, overrides in `selectRules`; analyze loads the library.
3. UI: `/claims`, `/disclaimers`, linked claims + facts used in the Info tab, fix-from-finding buttons, dashboard
   counts, saved views + CSV on the promotions list, overrides on the rulebook.
4. Gate, report.
