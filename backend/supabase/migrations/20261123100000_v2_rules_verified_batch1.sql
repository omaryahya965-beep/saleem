-- 20261123100000_v2_rules_verified_batch1 (D220): verified activation batch 1 — see scripts/rules/verified-batch-2026-11-23.mjs (generated).
-- Activates only rules whose verbatim provision was copied from an official source opened on 2026-11-23, with the
-- owner as reviewer of record; archives duplicates; corrects wrong or dead source links. Rollback: rollbacks/.
begin;

-- Sources
update public.regulatory_sources set verification = 'official_text_opened', status = 'in_force', verified_at = now(),
  verified_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, notes = $q$2026-11-23: النص العربي فُتح (PDF رسمي، معدّل بقرار مجلس الهيئة 1-94-2025 وتاريخ 9/3/1447هـ).$q$
where id = 'sa:CMA';
update public.regulatory_sources set url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$, verification = 'official_text_opened', status = 'in_force',
  verified_at = now(), verified_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$,
  notes = $q$2026-11-23: النص العربي فُتح في دليل أنظمة البنك المركزي؛ تعميم 44064343 وتاريخ 1444/08/13هـ، الحالة «نافذ».$q$
where id = 'sama-adv-rules-2023';
update public.regulatory_sources set url = $q$https://mc.gov.sa/DOC/ECV.pdf$q$, verification = 'official_text_opened', status = 'in_force',
  verified_at = now(), verified_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$,
  notes = $q$2026-11-23: نص المادتين 10 و11 منقول في «دليل الإيضاح الإعلاني وفقاً لنظام التجارة الإلكترونية» الرسمي لوزارة التجارة. موقع هيئة الخبراء (laws.boe.gov.sa) لم يُفتح من بيئة التطوير.$q$
where id = 'mc-ecommerce-law';
update public.regulatory_sources set url = $q$https://gmedia.gov.sa/ar/services/licensing-for-providing-advertising-content-through-social-media-platforms-trusted$q$,
  notes = $q$2026-11-23: الرابط السابق www.mawthooq.sa ليس موقع الهيئة (موقع شركة صيانة) فاستُبدل بصفحة خدمة «موثوق» الرسمية. المنصة mawthooq.gmedia.gov.sa لا تُفتح من بيئة التطوير، ولم يُنسخ نص الشروط بعد.$q$
where id = 'gmedia-mawthooq';
update public.regulatory_sources set url = $q$https://sdaia.gov.sa/en/SDAIA/about/Files/File0001.pdf$q$,
  notes = $q$2026-11-23: رابط وثيقة «إرشادات التزييف العميق» (SDAIA-P119). موقع سدايا يرفض الطلبات الآلية فلم يُنسخ النص بعد.$q$
where id = 'sdaia-deepfakes';
insert into public.regulatory_sources (id, authority, title_ar, title_en, url, status, verification, notes)
values ('gmedia-content-controls-2025', 'GMEDIA', 'ضوابط المحتوى الإعلامي — الهيئة العامة لتنظيم الإعلام (سبتمبر 2025)',
  'GMEDIA media content controls (September 2025)', 'https://gmedia.gov.sa/ar', 'unknown', 'secondary_only',
  $q$2026-11-23: الضوابط أعلنتها الهيئة في 21–22 سبتمبر 2025 ونقلتها الصحف؛ النص الرسمي غير منشور في صفحة يمكن فتحها من بيئة التطوير. الرابط السابق gcam.gov.sa لم يعد يعمل.$q$)
on conflict (id) do nothing;

-- Active rules with wrong or dead links (they stay active, with an honest verification status)
-- Creator rules (CNT, MAW, AI-01, COM-01). On a fresh local install they are created later by seed.sql
-- (v2_publish_rulebook copies them from v1), so seed.sql calls this function again after publishing.
create or replace function public.d220_fix_creator_rules() returns void language sql security definer set search_path = '' as $f$
update public.rules set regulatory_source_id = 'gmedia-content-controls-2025', source_url = 'https://gmedia.gov.sa/ar',
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$كل محتوى إعلامي يُنشر على المنصات الرقمية، ومنه محتوى صنّاع المحتوى والإعلانات، أياً كان الناشر (بحسب ما أعلنته الهيئة في سبتمبر 2025).$q$),
  change_reason = $q$D220 (2026-11-23): الرابط gcam.gov.sa لم يعد يعمل؛ المصدر: ضوابط المحتوى الإعلامي لهيئة تنظيم الإعلام (سبتمبر 2025).$q$
where code in ('CNT-01','CNT-02','CNT-03','CNT-04','CNT-05','CNT-06') and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set source_url = $q$https://gmedia.gov.sa/ar/services/licensing-for-providing-advertising-content-through-social-media-platforms-trusted$q$,
  change_reason = $q$D220 (2026-11-23): الرابط السابق www.mawthooq.sa لموقع شركة صيانة؛ استُبدل بصفحة خدمة «موثوق» الرسمية.$q$
where code in ('MAW-01','MAW-02','MAW-03','MAW-04') and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set source_url = $q$https://sdaia.gov.sa/en/SDAIA/about/Files/File0001.pdf$q$ where code = $q$AI-01$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$تنص المادة (الحادية عشرة) من نظام التجارة الإلكترونية على أن يحظر تضمين الإعلان الإلكتروني ما يأتي: أ/ عرضاً أو بياناً أو ادعاءً كاذباً أو مصوغاً بعبارات من شأنها أن تؤدي بصورة مباشرة أو غير مباشرة إلى خداع المستهلك أو تضليله.$q$, article_ref = $q$نظام التجارة الإلكترونية، المادة (11) الفقرة (أ)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$كل إعلان إلكتروني يقوم به موفر الخدمة بهدف تشجيع بيع منتج أو تقديم خدمة بأسلوب مباشر أو غير مباشر (تعريف «الإعلان الإلكتروني» في النظام).$q$),
  regulatory_source_id = $q$mc-ecommerce-law$q$, source_url = $q$https://mc.gov.sa/DOC/ECV.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل الإيضاح الإعلاني الرسمي لوزارة التجارة (ECV.pdf)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$COM-01$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
$f$;
revoke all on function public.d220_fix_creator_rules() from public, anon, authenticated;
select public.d220_fix_creator_rules();

-- CMA: activate (verbatim provisions), archive duplicates
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$ب) قبل إرسال إعلان الأوراق المالية المعدّ مسبقاً، أو اعتماد محتواه لإرساله من قبل شخص آخر، يجب على مؤسسة السوق المالية التأكد من الآتي: 1) استيفاء إعلان الأوراق المالية لمتطلبات هذا الباب بعد اعتماده من مسؤول معيّن لدى مؤسسة السوق المالية. … و) يجب على مؤسسة السوق المالية الاحتفاظ بسجل كامل بكل إعلان أوراق مالية معدّ مسبقاً اعتمدته وتأكدت من مطابقته للمتطلبات.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، المادة 33(ب)(1) و33(و)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات الأوراق المالية المعدّة مسبقاً التي تصدرها مؤسسة السوق المالية أو تعتمد محتواها (إجراء داخلي يُتحقق منه بسجل الاعتماد).$q$),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$CMA-CMI-33-APPROVAL$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$ب) قبل إرسال إعلان الأوراق المالية المعدّ مسبقاً، أو اعتماد محتواه لإرساله من قبل شخص آخر، يجب على مؤسسة السوق المالية التأكد من الآتي: … 2) أن الإعلان واضح وعادل وغير مضلل.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، المادة 33(ب)(2)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$كل إعلان أوراق مالية معدّ مسبقاً تصدره مؤسسة السوق المالية أو تعتمده.$q$),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$CMA-CMI-33-FAIR$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$33(ب)(3): أن الإعلان المعتمد محتواه لإرساله من قبل شخص آخر يتضمن الإفصاح بشكل واضح وعادل وغير مضلل بأن ذلك الشخص تلقى أو سيتلقى منافع مقابل إرسال ذلك الإعلان. الملحق (5-1) البند 12 «منافع الشخص المعلن»: إذا كانت محتويات الإعلان معتمدة من قبل مؤسسة السوق المالية لإرسالها من قبل شخص آخر، يجب على مؤسسة السوق المالية تضمين الإعلان بياناً تفصح فيه بشكل واضح وعادل وغير مضلل بأن ذلك الشخص تلقى أو سيتلقى منافع مقابل إرسال ذلك الإعلان.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، المادة 33(ب)(3)؛ الملحق (5-1) البند 12$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات أوراق مالية تعتمدها مؤسسة السوق المالية ويرسلها شخص آخر، ومنهم صنّاع المحتوى والمؤثرون.$q$),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$CMA-CMI-33-BENEFIT$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$يجب على مؤسسة السوق المالية عدم إرسال إعلان أوراق مالية إلى عميل تجزئة يتعلق بصندوق استثمار غير مخصص لعملاء التجزئة أو بمشتقات الأوراق المالية، إلا إذا قررت أن الأوراق المالية ملائمة لذلك العميل.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، المادة 35$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات موجهة لعملاء التجزئة عن صناديق استثمار غير مخصصة لهم أو عن مشتقات الأوراق المالية.$q$),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$CMA-CMI-35-RETAIL$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$9) الأداء السابق: يشترط في المعلومات المتعلقة بالأداء السابق للأوراق المالية أو لمؤسسة السوق المالية التي يتضمنها الإعلان ما يلي: 1) أن تشكل عرضاً عادلاً للأداء السابق للأوراق المالية أو لمؤسسة السوق المالية. 2) أن لا يتم اختيارها للمبالغة في أداء الأوراق المالية أو مؤسسة السوق المالية. 3) أن تبيّن مصدر المعلومات. 4) أن تكون مبنية على معلومات يمكن التأكد منها. 5) أن تحذر من أن الأداء السابق ليس بالضرورة دليلاً على الأداء في المستقبل.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، الملحق (5-1) البند 9$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات الأوراق المالية التي تتضمن معلومات عن الأداء السابق للورقة المالية أو لمؤسسة السوق المالية.$q$),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$CMA-CMI-A51-PAST$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$13) تذبذب القيمة: في الحالات التي يمكن فيها أن تتذبذب أسعار أو قيمة الأوراق المالية، يجب أن يتضمن الإعلان إفادة تبين أن الأسعار أو القيمة أو الدخل يمكن أن ينخفض، وتحذيراً حيث يلزم من أن المستثمر يمكن أن يسترد مبلغاً أقل من المبلغ الذي استثمره. 17) الأوراق المالية بعملة أجنبية: إذا كانت الورقة المالية بعملة أجنبية، يجب تحذير المستثمر من أن التغير في أسعار العملات يمكن أن يؤدي إلى تأثير سلبي على قيمة أو سعر أو دخل الورقة المالية. 18) الأوراق المالية غير القابلة للتحويل الفوري إلى سيولة: يجب أن ينص أي إعلان لورقة مالية غير قابلة للتحويل الفوري إلى سيولة على أنه قد يصعب على المستثمر: 1) بيع الورقة المالية أو تحويلها إلى نقد. 2) الحصول على معلومات موثوق بها حول قيمة الورقة المالية، أو مدى المخاطر التي تكون معرضة لها. 19) أتعاب البيع والرسوم: 1) إذا كان الإعلان يتعلق بورقة مالية تُخصم رسومها ومصاريفها في تاريخ الاستثمار الأولي أو عند بيع الاستثمار، يجب تضمين تحذير من أن تلك الرسوم قد تنطبق. 2) إذا كان الإعلان يتعلق بورقة مالية تنطبق عليها رسوم مرتبطة بالأداء، يجب تضمين تحذير من أن تلك الرسوم قد تنطبق.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، الملحق (5-1) البنود 13 و17 و18 و19$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات معدّة مسبقاً عن أوراق مالية محددة، كلٌّ بحسب حالته: القيمة المتذبذبة، العملة الأجنبية، عدم السيولة، الرسوم.$q$),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$CMA-CMI-A51-RISK$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$د) إذا كان إعلان الأوراق المالية المعدّ مسبقاً يتعلق بأوراق مالية معينة، يجب في هذه الحالة أن يحتوي على معلومات كافية لتمكين أي شخص من إجراء تقويم مدروس للأوراق المالية أو لنشاط الأوراق المالية ذي العلاقة.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، المادة 33(د)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-004$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$هـ) إذا علمت مؤسسة السوق المالية أن إعلان الأوراق المالية المعدّ مسبقاً لا يستوفي المتطلبات المنصوص عليها في هذا الباب، أو عند تلقيها توجيهاً من الهيئة في هذا الشأن، يجب عليها سحب الإعلان بأسرع وقت ممكن.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، المادة 33(هـ)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-005$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$ب) قبل القيام باتصال مباشر يجب على مؤسسة السوق المالية التأكد من الآتي: 1) موافقة المتلقي على تسلم إعلان الأوراق المالية. 2) أو أن المتلقي لديه علاقة عميل قائمة مع مؤسسة السوق المالية، ويُتوقع بموجب هذه العلاقة أن يتلقى هذا النوع من إعلانات الأوراق المالية.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، المادة 34(ب)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-007$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$ج) يجب على مؤسسة السوق المالية التأكد من أن أي شخص يقوم باتصال مباشر نيابة عنها، بما في ذلك أي شخص مسجل أو أي موظف آخر: … 3) يوضح غرض إعلان الأوراق المالية في بداية الاتصال، ويعرّف بنفسه وبمؤسسة السوق المالية التي يمثلها.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، المادة 34(ج)(3)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-008$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$ج) يجب على مؤسسة السوق المالية التأكد من أن أي شخص يقوم باتصال مباشر نيابة عنها: … 4) ولا يقوم بالاتصال بأي شخص في غير أوقات العمل ما لم يكن الشخص قد وافق مسبقاً على ذلك الاتصال.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، المادة 34(ج)(4)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-009$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$1) وضوح الغرض: يجب إيضاح الغرض من الإعلان.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، الملحق (5-1) البند 1$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-011$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$2) وضوح الموضوع: يجب أن تكون طبيعة ونوع أعمال الأوراق المالية ونوع الأوراق المالية التي يُعلن عنها واضحة.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، الملحق (5-1) البند 2$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-012$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$3) البيانات أو الوعود أو التوقعات: يجب أن يكون أي بيان أو وعد أو توقع عادلاً وغير مضلل في شكله ومضمونه. وفي حالة كون أي وعد أو توقع مبنياً على افتراضات، يجب بيان تلك الافتراضات.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، الملحق (5-1) البند 3$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-013$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$3) … ولا يجوز أن يشتمل الإعلان على توقع سعر مستقبلي محتمل للأوراق المالية.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، الملحق (5-1) البند 3$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-014$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$4) عدم وجود بيانات خاطئة أو مضللة: لا يجوز أن يحتوي الإعلان على أي بيانات خاطئة، أو مضللة تتعلق بأعمال الأوراق المالية لمؤسسة السوق المالية، أو حجمها، أو مواردها، أو أي نوع من الأوراق المالية.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، الملحق (5-1) البند 4$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-015$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$5) الاسم والعنوان والوضع النظامي: يجب أن يحتوي الإعلان (أو أن يوضح الشخص الذي يقوم بالإعلان) اسم وعنوان مؤسسة السوق المالية، مع إيضاح حصول مؤسسة السوق المالية على ترخيص من الهيئة.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، الملحق (5-1) البند 5$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-016$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$6) الضمانات: يجب أن لا يصف الإعلان أي ورقة مالية على أنها مضمونة ما لم يكن هناك ترتيب مبرم مع طرف ثالث ملزم وواجب التنفيذ نظاماً يضمن الوفاء التام بمطالبة المستثمر بموجب الضمان. وفي هذه الحالة يجب أن يحتوي الإعلان على تفاصيل كافية عن الضامن والضمان لتمكين أي مستثمر من إجراء تقويم عادل لقيمة الضمان.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، الملحق (5-1) البند 6$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-017$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$7) المقارنات: يجب أن تكون الإعلانات التي تقارن بين أوراق مالية أو خدمات مختلفة: 1) مبنية على حقائق تأكدت منها مؤسسة السوق المالية أو افتراضات مذكورة في الإعلان. 2) معروضة بطريقة عادلة ومتوازنة. 3) لا تغفل أي شيء جوهري يتعلق بالمقارنة.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، الملحق (5-1) البند 7$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-018$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$8) المصلحة الجوهرية: يجب على مؤسسة السوق المالية تضمين الإعلان بياناً يوضح الأحوال التي تعلم فيها أنها هي أو أي من تابعيها: 1) تملك أو يمكن أن تملك مركزاً استثمارياً، أو حصة في الأوراق المالية المعنية، أو في أوراق مالية ذات علاقة. 2) أو تقدّم أو قدّمت خلال الاثني عشر شهراً السابقة مشورة مهمة أو خدمات أعمال أوراق مالية لمُصدر الأوراق المالية المعنية أو أوراق مالية ذات علاقة.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، الملحق (5-1) البند 8$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-019$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$10) الزكاة والضرائب: إذا كان الإعلان يحتوي على أي إشارة إلى تأثير الزكاة والضرائب، يجب: 1) أن يبيّن مقدار الزكاة ومعدل الضريبة المفترض وأي إعفاءات. 2) أن ينص على احتمال تغير المعدلات والإعفاءات مع الوقت.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، الملحق (5-1) البند 10$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-023$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$11) حقوق الإلغاء: يجب أن يتضمن أي إعلان عن أوراق مالية تنطبق عليها حقوق إلغاء تفصيلاً عن تلك الحقوق بما في ذلك الفترة التي يجوز خلالها ممارستها.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، الملحق (5-1) البند 11$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-024$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$14) الملاءمة: إذا كان الإعلان يحتوي أو يشير إلى توصية حول ورقة مالية أو خدمة أوراق مالية محددة، يجب أن يحذّر الإعلان من أن هذه الورقة المالية قد لا تكون ملائمة لجميع الأشخاص الذين يتلقون الإعلان، وأنه إذا كانت لديهم أي شكوك، فعليهم الرجوع إلى مستشارهم الاستثماري.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، الملحق (5-1) البند 14$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-026$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$15) الأوراق المالية حادة التذبذب: إذا كان الإعلان يتعلق بورقة مالية معززة بالاقتراض، أو ورقة مالية مشروطة الالتزام، يجب أن ينص فيه بحسب الحالة على الآتي: 1) أن قيمة الورقة المالية يمكن أن تتعرض لانخفاض مفاجئ وكبير قد يؤدي إلى خسارة تساوي المبلغ المستثمر. 2) أن خسارة المستثمر قد لا تقتصر على كامل المبلغ الذي استثمره أو أودعه أصلاً، وأنه قد يضطر إلى دفع المزيد.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، الملحق (5-1) البند 15$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-027$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$16) دخل الاستثمار: إذا وُصفت ورقة مالية بأنها مناسبة لمستثمر يسعى بشكل خاص إلى الحصول على دخل من ورقته المالية، يجب تحذير المستثمر بحسب الحالة من الآتي: 1) أن دخل الورقة المالية يمكن أن يتغير. 2) أنه يمكن استخدام جزء من رأس المال المستثمر لدفع ذلك الدخل.$q$, article_ref = $q$لائحة مؤسسات السوق المالية، الملحق (5-1) البند 16$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), null),
  regulatory_source_id = $q$sa:CMA$q$, source_url = $q$https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من لائحة مؤسسات السوق المالية (PDF الهيئة)؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-CMA-028$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-CMA-001$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-CMA-002$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-CMA-003$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-CMA-006$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-CMA-010$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-CMA-020$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-CMA-021$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-CMA-022$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-CMA-025$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-CMA-029$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-CMA-030$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-CMA-031$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);

-- SAMA: activate (verbatim provisions), archive duplicates
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (1): على المؤسسات المالية بذل العناية اللازمة عند الإعلان عن المنتجات والخدمات من حيث محتوى الإعلان وطريقته، وتجنب استخدام أساليب مغرية أو مضللة أو غير دقيقة، وعدم المبالغة في عرض مميزات تلك المنتجات أو الخدمات المعلن عنها، ويجب أن تكون كافة العبارات والأرقام المستخدمة سهلة الفهم وبخط واضح ومقروء بما في ذلك الهوامش العلوية أو السفلية.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (1)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-01$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (2): يجب أن تكون اللغة العربية هي اللغة الأساسية المستخدمة في الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، ويستثنى من ذلك الإعلانات الموجهة لغير الناطقين باللغة العربية مع الالتزام التام بما ورد في هذه الضوابط.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (2)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المؤسسات المالية، باستثناء الإعلانات الموجهة لغير الناطقين باللغة العربية.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-02$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (3): على المؤسسات المالية استيفاء متطلبات الإعلان عن أي منتج أو خدمة والتي تشمل كحد أدنى الآتي: … 1.3 اسم وشعار وبيانات الاتصال بالمؤسسة المالية.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (3) الفقرة (1)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-03-1$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (3): على المؤسسات المالية استيفاء متطلبات الإعلان عن أي منتج أو خدمة والتي تشمل كحد أدنى الآتي: … 2.3 اسم المنتج أو الخدمة المُعلن عنها.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (3) الفقرة (2)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-03-2$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (3): على المؤسسات المالية استيفاء متطلبات الإعلان عن أي منتج أو خدمة والتي تشمل كحد أدنى الآتي: … 3.3 الشروط والأحكام الأساسية.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (3) الفقرة (3)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-03-3$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (3): على المؤسسات المالية استيفاء متطلبات الإعلان عن أي منتج أو خدمة والتي تشمل كحد أدنى الآتي: … 4.3 شريحة العملاء و/ أو المستهلكين المستهدفين.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (3) الفقرة (4)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-03-4$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (3): على المؤسسات المالية استيفاء متطلبات الإعلان عن أي منتج أو خدمة والتي تشمل كحد أدنى الآتي: … 5.3 كافة مبالغ الرسوم والعمولات المتعلقة باستخدام الخدمة أو المنتج شاملةً ضريبة القيمة المضافة، وإذا كان الإعلان عن وثيقة تأمين يجب أن يتم الإيضاح ما إذا كان السعر شاملاً كافة الرسوم أم لا.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (3) الفقرة (5)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-03-5$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (3): على المؤسسات المالية استيفاء متطلبات الإعلان عن أي منتج أو خدمة والتي تشمل كحد أدنى الآتي: … 6.3 الحد الأدنى من العمليات/ المتطلبات اللازمة للاستفادة من المنتج أو الخدمة - إن وُجدت -.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (3) الفقرة (6)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-03-6$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (3): على المؤسسات المالية استيفاء متطلبات الإعلان عن أي منتج أو خدمة والتي تشمل كحد أدنى الآتي: … 7.3 شرحاً للرموز المختصرة المشار اليها في الإعلان صراحةً بلغة الإعلان.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (3) الفقرة (7)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-03-7$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (3): على المؤسسات المالية استيفاء متطلبات الإعلان عن أي منتج أو خدمة والتي تشمل كحد أدنى الآتي: … 8.3 إذا كان الإعلان عن منتج أو خدمة تمويلية، يجب أن يتضمن بيان معدل النسبة السنوية (APR) ومدة التمويل بشكل واضح للعميل و/ أو المستهلك – إن وجدت -، ولا يجب أن يتضمن الإعلان معدلات أخرى لكلفة الأجل. وفي حال الإعلان عن منتج تمويل عقاري؛ فيجب توضيح أن كلفة الأجل متغيرة أو ثابتة.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (3) الفقرة (8)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التمويلية، ومنها التمويل العقاري.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-03-8$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (3): على المؤسسات المالية استيفاء متطلبات الإعلان عن أي منتج أو خدمة والتي تشمل كحد أدنى الآتي: … 9.3 مع مراعاة الفقرة (5-3) من المادة (5) يجب أن يشير الإعلان إلى أن المؤسسة المالية خاضعة لرقابة وإشراف البنك المركزي.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (3) الفقرة (9)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-03-9$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (4): مع مراعاة ما ورد في المادة (3) أعلاه، يتعيّن على المؤسسات المالية عند الإعلان عن أية عروض ترويجية، تضمين آلية الاستفادة من تلك العروض بطريقة واضحة تسهل على العملاء والمستهلكين تلقيها مع توضيح فترة بداية العرض ونهايته.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (4)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات العروض الترويجية للمؤسسات المالية.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-04$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (5): يُحظّر على المؤسسات المالية عند الإعلان القيام بالآتي: … 1-5 تقديم عرض أو بيان أو ادعاء غير صحيح أو أن يكون مصوغاً بعبارات من شأنها أن تؤدي بطريقة مباشرة أو غير مباشرة الى خداع أو تضليل العملاء و/ أو المستهلكين.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (5) الفقرة (1)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-05-1$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (5): يُحظّر على المؤسسات المالية عند الإعلان القيام بالآتي: … 2-5 تقديم إعلان يتضمن انتهاك لحقوق الملكية الفكرية أو استعمال علامة مقلدة.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (5) الفقرة (2)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-05-2$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (5): يُحظّر على المؤسسات المالية عند الإعلان القيام بالآتي: … 3-5 استخدام اسم و/ أو شعار البنك المركزي في إعلاناتها.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (5) الفقرة (3)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-05-3$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (5): يُحظّر على المؤسسات المالية عند الإعلان القيام بالآتي: … 4-5 تقديم إعلان يؤدي إلى إحداث لبس مع منتجات أو خدمات أو أسماء أخرى.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (5) الفقرة (4)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-05-4$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (5): يُحظّر على المؤسسات المالية عند الإعلان القيام بالآتي: … 5-5 المساس بالنظام العام والآداب العامة أو الإساءة لقيم وعادات المجتمع. 6-5 الإشارة في معنى الإعلان إلى التحريض على ارتكاب الجرائم أو إلى أي تمييز عنصري أو إثارة النزعات المذهبية او الطائفية أو القبلية أو المناطقية أو غيرها من نزاعات التعصب.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (5) الفقرتان (5) و(6)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-05-5$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (5): يُحظّر على المؤسسات المالية عند الإعلان القيام بالآتي: … 8-5 استخدام صور تمثل وجه أو مظهر أو جزء من وجه أو مظهر لعملة ورقية أو معدنية أو بلاستيكية متداولة نظاماً في المملكة العربية السعودية دون الحصول على عدم ممانعة من الجهات المختصة.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (5) الفقرة (8)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المؤسسات المالية التي تستخدم صور العملة السعودية المتداولة.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-05-8$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (5): يُحظّر على المؤسسات المالية عند الإعلان القيام بالآتي: … 7-5 الإعلان عن منتجات أو خدمات غير مشروعة.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (5) الفقرة (7)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SA-BANK-022$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (6): في حال كان المنتج أو الخدمة المعلن عنها مسعرة بالعملات الأجنبية أو في حال كانت قيمة المنتج أو الخدمة المعلن عنها تتأثر بسعر صرف العملات الأجنبية، فيجب أن يحتوي الإعلان على العبارة الآتية: "يمكن لسعر المنتج/ الخدمة التأثر بالتغيُّرات في سعر صرف العملات الأجنبية" على أن تكون العبارة بخط واضح ومقروء.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (6)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$منتجات أو خدمات مسعّرة بعملات أجنبية أو تتأثر قيمتها بسعر صرفها.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-06$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (7): يجب على المؤسسات المالية عند الإشارة إلى أن المنتج أو الخدمة تُقدم مجاناً، أن توضح ذلك بعبارة صريحة مع تحديد الفئة المستهدفة من المنتج أو الخدمة.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (7)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$الإعلانات التي تشير إلى أن المنتج أو الخدمة مجانية.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-07$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (8): يجب أن تراعي المؤسسة المالية عند الإعلان عن منتجاتها وخدماتها، عدم الإضرار بسمعة القطاع المالي ومصالح المؤسسات المالية الأخرى أو التقليل منها، أو الإخلال بمبدأ المنافسة.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (8)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-08$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (9): يُحظّر على المؤسسات المالية استخدام المعلومات والبيانات الشخصية التي تخص العملاء ضمن المواد الإعلانية إلا بعد الحصول على الموافقة الكتابية منهم.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (9)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$الإعلانات التي تستخدم معلومات أو بيانات شخصية لعملاء المؤسسة.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-09$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (10): يُحظّر على المؤسسات المالية إرسال أي إعلان لمنتجات تأمينية أو ائتمانية غير مناسبة للعملاء و/ أو المستهلكين الأفراد الذين تقل أعمارهم عن (ثمانية عشرة) عاماً هجرية.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (10)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات التأمينية أو الائتمانية المرسلة لأفراد تقل أعمارهم عن 18 عاماً هجرية.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-10$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (11): يجب على المؤسسات المالية الحصول على موافقة العميل كتابياً أو الكترونياً بشأن رغبته في استقبال الإعلانات المُرسلة له حسب القنوات التي يُفضلها العميل، وأن تمنح الحق للعميل بشكل دائم في رفض استقبال هذه الإعلانات بكل سهولة وبطرق واضحة ومحددة.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (11)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$الإعلانات المرسلة مباشرة إلى العملاء (رسائل، بريد، إشعارات).$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-11$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (12): تكون الإعلانات وما تضمنته من عروض أو مواصفات أو مزايا ملزمة على المؤسسات المالية، ويجب تضمين المواصفات المُعلن عنها ضمن العقد أو الاتفاقية أو الوثيقة أو ما في حكمها.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (12)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-12$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (13): تكون الإعلانات عبر القنوات الرسمية والموثوقة للمؤسسات المالية و/ أو عبر طرف ثالث مرخص له من الجهة المختصة، وعلى المؤسسات المالية التأكد من التزام الطرف الثالث بهذه الضوابط والتعليمات ذات العلاقة، وتتحمل المؤسسات المالية المسؤولية في حال عدم التزام الطرف الثالث بها.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (13)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المؤسسات المالية المنشورة عبر قنواتها أو عبر طرف ثالث، ومنهم صنّاع المحتوى.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-13$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (14): يجب على المؤسسات المالية تطوير سياسة خاصة بالإعلانات تتوافق مع هذه الضوابط والأنظمة والتعليمات الصادرة عن البنك المركزي والجهات المختصة، وكذلك التحقق من تطبيقها، وتحديثها متى ما دعت الحاجة إلى ذلك وبحدٍ أدنى مرة واحدة كل ثلاث سنوات.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (14)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-14$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (15): على إدارة الالتزام أو من يقوم بعملها في المؤسسة المالية مراجعة المواد الإعلانية والموافقة عليها كتابياً قبل نشرها بعد التأكد من موافقتها لأحكام هذه الضوابط وجميع الأنظمة واللوائح والتعليمات ذات العلاقة.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (15)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-15$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (16): مع عدم الإخلال باختصاصات الجهات المعنية في حال مخالفة الأنظمة الأخرى، تُعد المؤسسة المالية مسؤولة في حال تضمن محتوى إعلانها لأي مخالفة.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (16)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-16$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set
  review_state = 'active', legal_status = 'legally_reviewed', source_verified = true,
  official_text_ar = $q$المادة (17): للبنك المركزي إلزام المؤسسات المالية التي لا تتقيد بالتعليمات الواردة في هذه الضوابط أو التعليمات ذات العلاقة بسحب الإعلان خلال يوم عمل واحد من إخطار البنك المركزي لها بذلك.$q$, article_ref = $q$ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية، المادة (17)$q$,
  applicability_ar = coalesce(nullif(applicability_ar, ''), $q$إعلانات المنتجات والخدمات التي تقدمها المؤسسات المالية المرخص لها من البنك المركزي السعودي.$q$),
  regulatory_source_id = $q$sama-adv-rules-2023$q$, source_url = $q$https://rulebook.sama.gov.sa/ar/node/1715$q$,
  legal_reviewed_by = $q$مالك منصة سَليم (omaryahya965-beep)$q$, legal_reviewed_at = now(), change_reason = $q$D220 (2026-11-23): النص الرسمي منقول حرفياً من دليل أنظمة البنك المركزي السعودي؛ اعتمدها المالك بعد التحقق.$q$
where code = $q$SAMA-ADV-17$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-001$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-002$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-003$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-004$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-005$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-006$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-007$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-008$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-009$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-010$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-011$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-012$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-013$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-014$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-015$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-016$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-017$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-018$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-019$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-020$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-021$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-023$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-024$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-025$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-026$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-027$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-028$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-029$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-030$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-031$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-032$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-033$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);
update public.rules set review_state = 'archived', change_reason = $q$D220 (2026-11-23): مكررة — يغطيها حكم القاعدة المفعّلة المذكورة في possible_duplicate_of.$q$ where code = $q$SA-BANK-034$q$ and rulebook_version_id = (select id from public.rulebook_versions order by created_at desc limit 1);

commit;
