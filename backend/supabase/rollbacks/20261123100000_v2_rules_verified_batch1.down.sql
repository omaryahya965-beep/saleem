-- Rollback of 20261123100000_v2_rules_verified_batch1 (D220): restores the values read before the batch (generated).
begin;
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$17$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-17$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$16$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-16$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$15$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-15$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$14$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-14$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$13$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-13$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$12$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-12$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$11$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-11$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$10$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-10$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$9$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-09$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$8$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-08$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$7$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-07$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$6$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-06$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$5.8$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-05-8$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$5.5–5.6$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-05-5$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$5.4$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-05-4$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$5.3$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-05-3$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$5.2$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-05-2$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$5.1$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-05-1$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$33$q$,
  applicability_ar = null, regulatory_source_id = $q$cma-cmi-regs$q$, source_url = $q$https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$CMA-CMI-33-APPROVAL$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$4$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-04$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$3.9$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-03-9$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$3.8$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-03-8$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$3.7$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-03-7$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$3.6$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-03-6$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$3.5$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-03-5$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$3.4$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-03-4$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$3.3$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-03-3$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$3.2$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-03-2$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$3.1$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-03-1$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$2$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-02$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$1$q$,
  applicability_ar = null, regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SAMA-ADV-01$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$35$q$,
  applicability_ar = null, regulatory_source_id = $q$cma-cmi-regs$q$, source_url = $q$https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$CMA-CMI-35-RETAIL$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$Annex 5-1$q$,
  applicability_ar = null, regulatory_source_id = $q$cma-cmi-regs$q$, source_url = $q$https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$CMA-CMI-A51-RISK$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$Annex 5-1$q$,
  applicability_ar = null, regulatory_source_id = $q$cma-cmi-regs$q$, source_url = $q$https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$CMA-CMI-A51-PAST$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$33$q$,
  applicability_ar = null, regulatory_source_id = $q$cma-cmi-regs$q$, source_url = $q$https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$CMA-CMI-33-BENEFIT$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$33$q$,
  applicability_ar = null, regulatory_source_id = $q$cma-cmi-regs$q$, source_url = $q$https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$CMA-CMI-33-FAIR$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م33(د)$q$,
  applicability_ar = $q$إعلان معد مسبقًا عن ورقة مالية محددة$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-004$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م33(ب)(3)؛ ملحق 5-1 بند12$q$,
  applicability_ar = $q$إعلان معتمد من المؤسسة لإرساله بواسطة طرف آخر$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-003$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م34(ب)$q$,
  applicability_ar = $q$الاتصال المباشر$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-007$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م34(ج)(3)$q$,
  applicability_ar = $q$الاتصال المباشر$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-008$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م34(ج)(4)$q$,
  applicability_ar = $q$الاتصال المباشر خارج العمل$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-009$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند1$q$,
  applicability_ar = $q$إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-011$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند2$q$,
  applicability_ar = $q$إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-012$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند3$q$,
  applicability_ar = $q$إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-013$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند5$q$,
  applicability_ar = $q$إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-016$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند6$q$,
  applicability_ar = $q$إعلان محدد يزعم وجود ضمان$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-017$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند7$q$,
  applicability_ar = $q$مقارنة أوراق مالية أو خدمات$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-018$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند8$q$,
  applicability_ar = $q$إعلان محدد وحالات المصلحة الجوهرية$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-019$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند10$q$,
  applicability_ar = $q$إذا ذُكر أثر الزكاة أو الضرائب$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-023$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند11$q$,
  applicability_ar = $q$إذا انطبقت حقوق الإلغاء$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-024$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند13$q$,
  applicability_ar = $q$ورقة محددة قابلة للتذبذب$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-025$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند14$q$,
  applicability_ar = $q$توصية بأداة أو خدمة محددة$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-026$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند15$q$,
  applicability_ar = $q$أداة معززة بالاقتراض أو مشروطة الالتزام$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-027$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند16$q$,
  applicability_ar = $q$منتج مسوّق لمستثمر الدخل$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-028$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند17$q$,
  applicability_ar = $q$ورقة مالية بعملة أجنبية$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-029$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م5 فقرة7$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-022$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$active$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = null,
  applicability_ar = null, regulatory_source_id = $q$sdaia-deepfakes$q$, source_url = $q$https://sdaia.gov.sa$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$AI-01$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$active$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = null,
  applicability_ar = null, regulatory_source_id = $q$mc-ecommerce-law$q$, source_url = $q$https://mc.gov.sa$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$COM-01$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$active$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = null,
  applicability_ar = null, regulatory_source_id = $q$gmedia-mawthooq$q$, source_url = $q$https://www.mawthooq.sa$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$MAW-01$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$active$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = null,
  applicability_ar = null, regulatory_source_id = $q$gmedia-mawthooq$q$, source_url = $q$https://www.mawthooq.sa$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$MAW-02$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$active$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = null,
  applicability_ar = null, regulatory_source_id = null, source_url = $q$https://gcam.gov.sa$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$CNT-01$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$active$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = null,
  applicability_ar = null, regulatory_source_id = null, source_url = $q$https://gcam.gov.sa$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$CNT-02$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$active$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = null,
  applicability_ar = null, regulatory_source_id = null, source_url = $q$https://gcam.gov.sa$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$CNT-03$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$active$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = null,
  applicability_ar = null, regulatory_source_id = null, source_url = $q$https://gcam.gov.sa$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$CNT-04$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$active$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = null,
  applicability_ar = null, regulatory_source_id = null, source_url = $q$https://gcam.gov.sa$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$CNT-05$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$active$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = null,
  applicability_ar = null, regulatory_source_id = null, source_url = $q$https://gcam.gov.sa$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$CNT-06$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$active$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = null,
  applicability_ar = $q$ينطبق على الإعلان عبر صانع محتوى أو مؤثر (إعلان برعاية أو نشر عبر صانع محتوى). لا يُطبَّق تلقائياً على نشر الجهة عبر قنواتها الرسمية؛ تطبيقه على الحسابات الرسمية للجهات يحتاج تأكيداً قانونياً.$q$, regulatory_source_id = $q$gmedia-mawthooq$q$, source_url = $q$https://www.mawthooq.sa$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = $q$D171: Mawthooq licence and the written creator agreement concern advertising through natural-person creators (GAMR/Mawthooq); excluded for own-channel corporate publication pending legal confirmation.$q$
where code = $q$MAW-03$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$active$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = null,
  applicability_ar = $q$ينطبق على الإعلان عبر صانع محتوى أو مؤثر (إعلان برعاية أو نشر عبر صانع محتوى). لا يُطبَّق تلقائياً على نشر الجهة عبر قنواتها الرسمية؛ تطبيقه على الحسابات الرسمية للجهات يحتاج تأكيداً قانونياً.$q$, regulatory_source_id = $q$gmedia-mawthooq$q$, source_url = $q$https://www.mawthooq.sa$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = $q$D171: Mawthooq licence and the written creator agreement concern advertising through natural-person creators (GAMR/Mawthooq); excluded for own-channel corporate publication pending legal confirmation.$q$
where code = $q$MAW-04$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م33(هـ)$q$,
  applicability_ar = $q$إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-005$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند3$q$,
  applicability_ar = $q$إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-014$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند4$q$,
  applicability_ar = $q$إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-015$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند9$q$,
  applicability_ar = $q$عند عرض الأداء السابق$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-020$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م33(و)$q$,
  applicability_ar = $q$إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-006$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م33(ب)(1)$q$,
  applicability_ar = $q$إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-001$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م3 فقرة4$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-007$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م33(ب)(2)$q$,
  applicability_ar = $q$إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-002$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م35$q$,
  applicability_ar = $q$صندوق غير مخصص للتجزئة أو مشتقات$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-010$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند9$q$,
  applicability_ar = $q$عند عرض الأداء السابق$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-021$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند9$q$,
  applicability_ar = $q$عند عرض الأداء السابق$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-022$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند19$q$,
  applicability_ar = $q$حيث تنطبق تلك الرسوم$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-031$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$ملحق 5-1 بند18$q$,
  applicability_ar = $q$ورقة غير قابلة للتحويل الفوري لسيولة$q$, regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-CMA-030$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م1$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-002$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م1$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-001$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م2$q$,
  applicability_ar = $q$استثناء إعلان موجه لغير الناطقين بالعربية$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-003$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م3 فقرة1$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-004$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م3 فقرة2$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-005$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م3 فقرة3$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-006$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م3 فقرة5$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-008$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م3 فقرة5$q$,
  applicability_ar = $q$إعلان وثيقة تأمين عندما تكون هذه الضوابط منطبقة$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-009$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م3 فقرة6$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-010$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م3 فقرة7$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-011$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م3 فقرة8$q$,
  applicability_ar = $q$إعلان تمويل$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-013$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م3 فقرة8$q$,
  applicability_ar = $q$تمويل عقاري$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-014$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م3 فقرة8$q$,
  applicability_ar = $q$إعلان تمويل$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-012$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م3 فقرة9$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-015$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م4$q$,
  applicability_ar = $q$عرض ترويجي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-016$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م5 فقرة1$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-017$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م5 فقرة2$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-018$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م5 فقرة3$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-019$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م5 فقرة4$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-020$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م5 فقرة5-6$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-021$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م5 فقرة8$q$,
  applicability_ar = $q$إذا استُخدمت صور العملة$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-023$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م6$q$,
  applicability_ar = $q$سعر بعملة أجنبية أو منتج يتأثر بها؛ راجع صيغة المادة حرفيًا عند الاعتماد$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-024$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م7$q$,
  applicability_ar = $q$عند الادعاء بالمجانية$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-025$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م8$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-026$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م9$q$,
  applicability_ar = $q$عند استخدام بيانات عملاء$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-027$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م10$q$,
  applicability_ar = $q$أفراد دون 18 عامًا هجريًا$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-028$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م11$q$,
  applicability_ar = $q$إعلانات مرسلة للعملاء$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-029$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م12$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-030$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م13$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-031$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م14$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-032$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م15$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-033$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = $q$draft$q$, legal_status = $q$illustrative_pending_review$q$,
  source_verified = false, official_text_ar = null, article_ref = $q$م17$q$,
  applicability_ar = $q$المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي$q$, regulatory_source_id = $q$sa:SAMA$q$, source_url = $q$https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$,
  legal_reviewed_by = null, legal_reviewed_at = null, change_reason = null
where code = $q$SA-BANK-034$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.regulatory_sources set url = $q$https://rulebook.sama.gov.sa/en/node/1715$q$, status = $q$in_force$q$, verification = $q$official_text_opened$q$,
  verified_at = null, verified_by = null, notes = $q$AR PDF: https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf$q$ where id = $q$sama-adv-rules-2023$q$;
update public.regulatory_sources set url = $q$https://mc.gov.sa/ar/mediacenter/News/Pages/28-09-22-01.aspx$q$, status = $q$in_force$q$, verification = $q$official_status_unconfirmed$q$,
  verified_at = null, verified_by = null, notes = $q$Article numbers to be matched on laws.boe.gov.sa.$q$ where id = $q$mc-ecommerce-law$q$;
update public.regulatory_sources set url = $q$https://www.mawthooq.sa$q$, status = $q$in_force$q$, verification = $q$secondary_only$q$,
  verified_at = null, verified_by = null, notes = $q$Official site blocks automated reading; secondary: https://www.aleqt.com/2022/08/01/article_2363606.html$q$ where id = $q$gmedia-mawthooq$q$;
update public.regulatory_sources set url = $q$https://sdaia.gov.sa$q$, status = $q$guideline$q$, verification = $q$secondary_only$q$,
  verified_at = null, verified_by = null, notes = $q$Secondary: https://www.arabnews.pk/saudi-arabia/saudi-arabia-sets-out-ai-principles-for-media-calls-for-disclosure-of-synthetic-content-3006305$q$ where id = $q$sdaia-deepfakes$q$;
update public.regulatory_sources set url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$, status = $q$unknown$q$, verification = $q$official_status_unconfirmed$q$,
  verified_at = null, verified_by = null, notes = $q$نسخة منشورة 2025؛ الملحق 5-1 — إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة$q$ where id = $q$sa:CMA$q$;
delete from public.regulatory_sources where id = 'gmedia-content-controls-2025';
drop function if exists public.d220_fix_creator_rules();
commit;
