# مطابقة قواعد البنك المركزي وهيئة السوق المالية — القديمة مقابل CSV v0.1

مولَّد بالأمر `node backend/scripts/gen-rule-mapping.mjs` من قاعدة محلية فيها كل الـ migrations. **للمراجعة والاعتماد فقط:**
لم يُستبدل أو يُدمج أو يُحذف أو يُعطَّل أي قاعدة. التصنيف آلي ومتحفّظ:

| التصنيف | المعنى |
|---|---|
| Exact Match | المستند نفسه، ورقم المادة والفقرة/البند متطابقان. التطابق في **الإحالة**، لا يعني تطابق الصياغة. |
| Verified Equivalent | **لا يُعيَّن آلياً.** يملؤه المراجع القانوني بعد مقارنة نص المادة الرسمي. |
| Possible Match | المستند نفسه وإحدى الإحالتين أعمّ من الأخرى (مثل «م33» و«م33(د)»)، أو تشابه نصي ≥ 0.30. الفقرات الشقيقة (3.1 و3.2) لا تُعدّ مطابقة. |
| No Match | لا مستند ولا مادة ولا تشابه كافٍ. |

**حالة القواعد الآن:** القديمة (36) كلها **مسودات** (`draft`)، ولا توجد قاعدة قديمة مفعّلة ومُتحقَّق منها
قانونياً، فلا شيء يُحفظ «لأنه مُتحقَّق». الجديدة (65) مسودات أيضاً. القواعد الجديدة التي لها مطابقة Exact أو Possible
(44) **مستبعدة من التحليلات** (السبب «تكرار محتمل — بانتظار المراجعة») حتى يقرّر المراجع، فلا تُطبَّق قاعدتان
متعارضتان أو مكررتان حتى لو فعّلت المنظمة المسودات.

**ما لا تحتويه البيانات:** تاريخ النفاذ غير موجود في القواعد القديمة ولا في ملف CSV (يوجد فقط تاريخ فحص المصدر في CSV)،
ونص المادة الرسمي غير مخزَّن. المقارنة هنا على الإحالة والمستند وملخص القاعدة. يجب على المراجع فتح نص المادة الرسمي.

الأعداد: Possible Match: 16 · Exact Match: 33 · No Match: 1 · قواعد جديدة بلا نظير قديم: 21

## الأزواج المحتملة

| # | القاعدة القديمة | المادة (قديم) | القاعدة الجديدة | المادة (جديد) | المستند نفسه؟ | التشابه | التصنيف | قرار المراجع |
|---|---|---|---|---|---|---|---|---|
| 1 | CMA-CMI-33-APPROVAL | 33 | SA-CMA-006 | م33(و) | نعم | 0.07 | Possible Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 2 | CMA-CMI-33-APPROVAL | 33 | SA-CMA-001 | م33(ب)(1) | نعم | 0.07 | Possible Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 3 | CMA-CMI-33-APPROVAL | 33 | SA-CMA-005 | م33(هـ) | نعم | 0.06 | Possible Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 4 | CMA-CMI-33-BENEFIT | 33 | SA-CMA-005 | م33(هـ) | نعم | 0.11 | Possible Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 5 | CMA-CMI-33-BENEFIT | 33 | SA-CMA-001 | م33(ب)(1) | نعم | 0.00 | Possible Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 6 | CMA-CMI-33-BENEFIT | 33 | SA-CMA-002 | م33(ب)(2) | نعم | 0.00 | Possible Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 7 | CMA-CMI-33-FAIR | 33 | SA-CMA-002 | م33(ب)(2) | نعم | 0.07 | Possible Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 8 | CMA-CMI-33-FAIR | 33 | SA-CMA-005 | م33(هـ) | نعم | 0.06 | Possible Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 9 | CMA-CMI-33-FAIR | 33 | SA-CMA-001 | م33(ب)(1) | نعم | 0.00 | Possible Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 10 | CMA-CMI-35-RETAIL | 35 | SA-CMA-010 | م35 | نعم | 0.00 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 11 | CMA-CMI-A51-PAST | Annex 5-1 | SA-CMA-021 | ملحق 5-1 بند9 | نعم | 0.25 | Possible Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 12 | CMA-CMI-A51-PAST | Annex 5-1 | SA-CMA-022 | ملحق 5-1 بند9 | نعم | 0.06 | Possible Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 13 | CMA-CMI-A51-PAST | Annex 5-1 | SA-CMA-031 | ملحق 5-1 بند19 | نعم | 0.06 | Possible Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 14 | CMA-CMI-A51-RISK | Annex 5-1 | SA-CMA-014 | ملحق 5-1 بند3 | نعم | 0.13 | Possible Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 15 | CMA-CMI-A51-RISK | Annex 5-1 | SA-CMA-015 | ملحق 5-1 بند4 | نعم | 0.13 | Possible Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 16 | CMA-CMI-A51-RISK | Annex 5-1 | SA-CMA-030 | ملحق 5-1 بند18 | نعم | 0.12 | Possible Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 17 | SAMA-ADV-01 | 1 | SA-BANK-002 | م1 | نعم | 0.11 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 18 | SAMA-ADV-01 | 1 | SA-BANK-001 | م1 | نعم | 0.05 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 19 | SAMA-ADV-02 | 2 | SA-BANK-003 | م2 | نعم | 0.22 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 20 | SAMA-ADV-03-1 | 3.1 | SA-BANK-004 | م3 فقرة1 | نعم | 0.30 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 21 | SAMA-ADV-03-2 | 3.2 | SA-BANK-005 | م3 فقرة2 | نعم | 0.38 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 22 | SAMA-ADV-03-3 | 3.3 | SA-BANK-006 | م3 فقرة3 | نعم | 0.13 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 23 | SAMA-ADV-03-4 | 3.4 | SA-BANK-007 | م3 فقرة4 | نعم | 0.33 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 24 | SAMA-ADV-03-5 | 3.5 | SA-BANK-008 | م3 فقرة5 | نعم | 0.31 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 25 | SAMA-ADV-03-5 | 3.5 | SA-BANK-009 | م3 فقرة5 | نعم | 0.06 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 26 | SAMA-ADV-03-6 | 3.6 | SA-BANK-010 | م3 فقرة6 | نعم | 0.22 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 27 | SAMA-ADV-03-7 | 3.7 | SA-BANK-011 | م3 فقرة7 | نعم | 0.10 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 28 | SAMA-ADV-03-8 | 3.8 | SA-BANK-013 | م3 فقرة8 | نعم | 0.09 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 29 | SAMA-ADV-03-8 | 3.8 | SA-BANK-014 | م3 فقرة8 | نعم | 0.09 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 30 | SAMA-ADV-03-8 | 3.8 | SA-BANK-012 | م3 فقرة8 | نعم | 0.08 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 31 | SAMA-ADV-03-9 | 3.9 | SA-BANK-015 | م3 فقرة9 | نعم | 0.09 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 32 | SAMA-ADV-04 | 4 | SA-BANK-016 | م4 | نعم | 0.13 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 33 | SAMA-ADV-05-1 | 5.1 | SA-BANK-017 | م5 فقرة1 | نعم | 0.23 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 34 | SAMA-ADV-05-2 | 5.2 | SA-BANK-018 | م5 فقرة2 | نعم | 0.15 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 35 | SAMA-ADV-05-3 | 5.3 | SA-BANK-019 | م5 فقرة3 | نعم | 0.14 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 36 | SAMA-ADV-05-4 | 5.4 | SA-BANK-020 | م5 فقرة4 | نعم | 0.08 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 37 | SAMA-ADV-05-5 | 5.5–5.6 | SA-BANK-021 | م5 فقرة5-6 | نعم | 0.21 | Possible Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 38 | SAMA-ADV-05-8 | 5.8 | SA-BANK-023 | م5 فقرة8 | نعم | 0.14 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 39 | SAMA-ADV-06 | 6 | SA-BANK-024 | م6 | نعم | 0.06 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 40 | SAMA-ADV-07 | 7 | SA-BANK-025 | م7 | نعم | 0.15 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 41 | SAMA-ADV-08 | 8 | SA-BANK-026 | م8 | نعم | 0.14 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 42 | SAMA-ADV-09 | 9 | SA-BANK-027 | م9 | نعم | 0.08 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 43 | SAMA-ADV-10 | 10 | SA-BANK-028 | م10 | نعم | 0.06 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 44 | SAMA-ADV-11 | 11 | SA-BANK-029 | م11 | نعم | 0.15 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 45 | SAMA-ADV-12 | 12 | SA-BANK-030 | م12 | نعم | 0.00 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 46 | SAMA-ADV-13 | 13 | SA-BANK-031 | م13 | نعم | 0.11 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 47 | SAMA-ADV-14 | 14 | SA-BANK-032 | م14 | نعم | 0.33 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 48 | SAMA-ADV-15 | 15 | SA-BANK-033 | م15 | نعم | 0.25 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 49 | SAMA-ADV-16 | 16 | — | — | — | — | No Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |
| 50 | SAMA-ADV-17 | 17 | SA-BANK-034 | م17 | نعم | 0.47 | Exact Match | ☐ Verified Equivalent ☐ ليست مطابقة ☐ تحتاج بحثاً |

## التفاصيل لكل زوج (المصدر، العنوان، المادة، النص، النطاق)

### CMA-CMI-33-APPROVAL ↔ SA-CMA-006 — Possible Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf) (cma-cmi-regs) | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf) (sa:CMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 33 → [33] | م33(و) → [33, و] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | اعتماد مسؤول مخوّل قبل الإعلان والاحتفاظ بسجل كامل؛ يتحقق بسجل الاعتماد في سَليم. | هل حُفظت النسخة المعتمدة وسجلها بالكامل؟ |
| النطاق والانطباق | {"sectors":["capital_market"],"communication_types":["financial_promotion"]} | إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة |
| نوع الفحص | — | workflow |
| الحالة | draft | draft |

### CMA-CMI-33-APPROVAL ↔ SA-CMA-001 — Possible Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf) (cma-cmi-regs) | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf) (sa:CMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 33 → [33] | م33(ب)(1) → [33, ب, 1] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | اعتماد مسؤول مخوّل قبل الإعلان والاحتفاظ بسجل كامل؛ يتحقق بسجل الاعتماد في سَليم. | هل اعتمد مسؤول معين النسخة الإعلانية قبل إرسالها؟ |
| النطاق والانطباق | {"sectors":["capital_market"],"communication_types":["financial_promotion"]} | إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة |
| نوع الفحص | — | workflow |
| الحالة | draft | draft |

### CMA-CMI-33-APPROVAL ↔ SA-CMA-005 — Possible Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf) (cma-cmi-regs) | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf) (sa:CMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 33 → [33] | م33(هـ) → [33, ه] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | اعتماد مسؤول مخوّل قبل الإعلان والاحتفاظ بسجل كامل؛ يتحقق بسجل الاعتماد في سَليم. | هل يُسحب الإعلان المخالف عند العلم أو توجيه الهيئة؟ |
| النطاق والانطباق | {"sectors":["capital_market"],"communication_types":["financial_promotion"]} | إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة |
| نوع الفحص | — | workflow |
| الحالة | draft | draft |

### CMA-CMI-33-BENEFIT ↔ SA-CMA-005 — Possible Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf) (cma-cmi-regs) | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf) (sa:CMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 33 → [33] | م33(هـ) → [33, ه] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | عند نشر الإعلان عبر شخص آخر يُفصح عن حصوله أو توقع حصوله على منفعة. | هل يُسحب الإعلان المخالف عند العلم أو توجيه الهيئة؟ |
| النطاق والانطباق | {"sectors":["capital_market"],"distribution":["influencer"],"communication_types":["financial_promotion"]} | إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة |
| نوع الفحص | — | workflow |
| الحالة | draft | draft |

### CMA-CMI-33-BENEFIT ↔ SA-CMA-001 — Possible Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf) (cma-cmi-regs) | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf) (sa:CMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 33 → [33] | م33(ب)(1) → [33, ب, 1] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | عند نشر الإعلان عبر شخص آخر يُفصح عن حصوله أو توقع حصوله على منفعة. | هل اعتمد مسؤول معين النسخة الإعلانية قبل إرسالها؟ |
| النطاق والانطباق | {"sectors":["capital_market"],"distribution":["influencer"],"communication_types":["financial_promotion"]} | إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة |
| نوع الفحص | — | workflow |
| الحالة | draft | draft |

### CMA-CMI-33-BENEFIT ↔ SA-CMA-002 — Possible Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf) (cma-cmi-regs) | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf) (sa:CMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 33 → [33] | م33(ب)(2) → [33, ب, 2] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | عند نشر الإعلان عبر شخص آخر يُفصح عن حصوله أو توقع حصوله على منفعة. | هل العرض عادل ومفهوم وغير خادع؟ |
| النطاق والانطباق | {"sectors":["capital_market"],"distribution":["influencer"],"communication_types":["financial_promotion"]} | إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### CMA-CMI-33-FAIR ↔ SA-CMA-002 — Possible Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf) (cma-cmi-regs) | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf) (sa:CMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 33 → [33] | م33(ب)(2) → [33, ب, 2] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | أن يكون الإعلان واضحاً وعادلاً وغير مضلل. | هل العرض عادل ومفهوم وغير خادع؟ |
| النطاق والانطباق | {"sectors":["capital_market"],"communication_types":["financial_promotion"]} | إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### CMA-CMI-33-FAIR ↔ SA-CMA-005 — Possible Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf) (cma-cmi-regs) | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf) (sa:CMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 33 → [33] | م33(هـ) → [33, ه] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | أن يكون الإعلان واضحاً وعادلاً وغير مضلل. | هل يُسحب الإعلان المخالف عند العلم أو توجيه الهيئة؟ |
| النطاق والانطباق | {"sectors":["capital_market"],"communication_types":["financial_promotion"]} | إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة |
| نوع الفحص | — | workflow |
| الحالة | draft | draft |

### CMA-CMI-33-FAIR ↔ SA-CMA-001 — Possible Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf) (cma-cmi-regs) | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf) (sa:CMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 33 → [33] | م33(ب)(1) → [33, ب, 1] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | أن يكون الإعلان واضحاً وعادلاً وغير مضلل. | هل اعتمد مسؤول معين النسخة الإعلانية قبل إرسالها؟ |
| النطاق والانطباق | {"sectors":["capital_market"],"communication_types":["financial_promotion"]} | إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة |
| نوع الفحص | — | workflow |
| الحالة | draft | draft |

### CMA-CMI-35-RETAIL ↔ SA-CMA-010 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf) (cma-cmi-regs) | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf) (sa:CMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 35 → [35] | م35 → [35] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | ألا تُعلن الصناديق الخاصة أو المشتقات لعملاء أفراد. | هل ثبتت ملاءمة المنتج قبل استهداف عميل تجزئة؟ |
| النطاق والانطباق | {"sectors":["capital_market"],"product_types":["non_retail_fund","derivatives"],"communication_types":["financial_promotion"]} | صندوق غير مخصص للتجزئة أو مشتقات |
| نوع الفحص | — | document |
| الحالة | draft | draft |

### CMA-CMI-A51-PAST ↔ SA-CMA-021 — Possible Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf) (cma-cmi-regs) | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf) (sa:CMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | Annex 5-1 → [A, 5, 1] | ملحق 5-1 بند9 → [A, 5, 1, 9] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | عرض الأداء السابق بإنصاف مع المصدر وتحذير بأنه لا يضمن النتائج المستقبلية. | هل يُذكر مصدر أرقام الأداء السابق؟ |
| النطاق والانطباق | {"sectors":["capital_market"],"communication_types":["financial_promotion"]} | عند عرض الأداء السابق |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### CMA-CMI-A51-PAST ↔ SA-CMA-022 — Possible Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf) (cma-cmi-regs) | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf) (sa:CMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | Annex 5-1 → [A, 5, 1] | ملحق 5-1 بند9 → [A, 5, 1, 9] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | عرض الأداء السابق بإنصاف مع المصدر وتحذير بأنه لا يضمن النتائج المستقبلية. | هل يوجد تنبيه بأن نتائج الماضي لا تعني بالضرورة استمرارها؟ |
| النطاق والانطباق | {"sectors":["capital_market"],"communication_types":["financial_promotion"]} | عند عرض الأداء السابق |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### CMA-CMI-A51-PAST ↔ SA-CMA-031 — Possible Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf) (cma-cmi-regs) | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf) (sa:CMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | Annex 5-1 → [A, 5, 1] | ملحق 5-1 بند19 → [A, 5, 1, 19] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | عرض الأداء السابق بإنصاف مع المصدر وتحذير بأنه لا يضمن النتائج المستقبلية. | هل يوجد تنبيه للرسوم عند الاستثمار أو البيع أو الرسوم المرتبطة بالأداء؟ |
| النطاق والانطباق | {"sectors":["capital_market"],"communication_types":["financial_promotion"]} | حيث تنطبق تلك الرسوم |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### CMA-CMI-A51-RISK ↔ SA-CMA-014 — Possible Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf) (cma-cmi-regs) | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf) (sa:CMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | Annex 5-1 → [A, 5, 1] | ملحق 5-1 بند3 → [A, 5, 1, 3] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | تحذيرات المخاطر ذات الصلة بالورقة المالية (انخفاض القيمة، العملة، السيولة، الرسوم). | هل يذكر الإعلان سعرًا مستقبليًا متوقعًا للورقة المالية؟ |
| النطاق والانطباق | {"sectors":["capital_market"],"communication_types":["financial_promotion"]} | إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### CMA-CMI-A51-RISK ↔ SA-CMA-015 — Possible Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf) (cma-cmi-regs) | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf) (sa:CMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | Annex 5-1 → [A, 5, 1] | ملحق 5-1 بند4 → [A, 5, 1, 4] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | تحذيرات المخاطر ذات الصلة بالورقة المالية (انخفاض القيمة، العملة، السيولة، الرسوم). | هل معلومات المؤسسة ومواردها أو الورقة المالية غير صحيحة؟ |
| النطاق والانطباق | {"sectors":["capital_market"],"communication_types":["financial_promotion"]} | إعلانات الأوراق المالية التابعة لمؤسسات السوق المالية أو المعتمدة منها؛ باستثناء الإعلانات المستثناة |
| نوع الفحص | — | hybrid |
| الحالة | draft | draft |

### CMA-CMI-A51-RISK ↔ SA-CMA-030 — Possible Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/en/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations-en.pdf) (cma-cmi-regs) | [لائحة مؤسسات السوق المالية](https://cma.gov.sa/RulesRegulations/Regulations/Documents/the_Capital_Market_Institutions_Regulations_ar.pdf) (sa:CMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | Annex 5-1 → [A, 5, 1] | ملحق 5-1 بند18 → [A, 5, 1, 18] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | تحذيرات المخاطر ذات الصلة بالورقة المالية (انخفاض القيمة، العملة، السيولة، الرسوم). | هل يُبيّن خطر صعوبة البيع أو التسييل أو تقدير القيمة والمخاطر؟ |
| النطاق والانطباق | {"sectors":["capital_market"],"communication_types":["financial_promotion"]} | ورقة غير قابلة للتحويل الفوري لسيولة |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-01 ↔ SA-BANK-002 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 1 → [1] | م1 → [1] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | ألا يستخدم الإعلان أساليب مغرية أو مضللة أو غير دقيقة، وأن تكون الشروط والأرقام واضحة. | هل العبارات والأرقام والهوامش واضحة ومقروءة؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-01 ↔ SA-BANK-001 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 1 → [1] | م1 → [1] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | ألا يستخدم الإعلان أساليب مغرية أو مضللة أو غير دقيقة، وأن تكون الشروط والأرقام واضحة. | هل توجد مبالغة أو لغة خادعة في وصف المزايا؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-02 ↔ SA-BANK-003 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 2 → [2] | م2 → [2] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | أن تكون العربية لغة الإعلان ما لم يستهدف غير الناطقين بها. | هل العربية هي اللغة الأساسية؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"audiences_exclude":["non_arabic_speakers"],"communication_types":["financial_promotion"]} | استثناء إعلان موجه لغير الناطقين بالعربية |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-03-1 ↔ SA-BANK-004 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 3.1 → [3, 1] | م3 فقرة1 → [3, 1] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | أن يتضمن الإعلان اسم المؤسسة وشعارها ووسيلة للتواصل. | هل تظهر هوية المؤسسة وشعارها ووسائل التواصل؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-03-2 ↔ SA-BANK-005 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 3.2 → [3, 2] | م3 فقرة2 → [3, 2] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | أن يتضمن الإعلان اسم المنتج أو الخدمة المعلن عنها. | هل اسم المنتج أو الخدمة واضح؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"requires_product":true,"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-03-3 ↔ SA-BANK-006 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 3.3 → [3, 3] | م3 فقرة3 → [3, 3] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | أن يتضمن الإعلان الشروط والأحكام الرئيسية للمنتج. | هل الشروط الجوهرية معلنة؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-03-4 ↔ SA-BANK-007 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 3.4 → [3, 4] | م3 فقرة4 → [3, 4] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | أن يحدد الإعلان الفئة المستهدفة من العملاء. | هل الفئة المستهدفة محددة؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-03-5 ↔ SA-BANK-008 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 3.5 → [3, 5] | م3 فقرة5 → [3, 5] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | أن يفصح الإعلان عن جميع الرسوم والعمولات شاملة ضريبة القيمة المضافة، وأن تطابق البيانات المعتمدة. | هل الرسوم والعمولات شاملة الضريبة؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"requires_product":true,"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | hybrid |
| الحالة | draft | draft |

### SAMA-ADV-03-5 ↔ SA-BANK-009 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 3.5 → [3, 5] | م3 فقرة5 → [3, 5] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | أن يفصح الإعلان عن جميع الرسوم والعمولات شاملة ضريبة القيمة المضافة، وأن تطابق البيانات المعتمدة. | هل ذُكر شمول سعر التأمين للرسوم أو عدمه؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"requires_product":true,"communication_types":["financial_promotion"]} | إعلان وثيقة تأمين عندما تكون هذه الضوابط منطبقة |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-03-6 ↔ SA-BANK-010 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 3.6 → [3, 6] | م3 فقرة6 → [3, 6] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | أن يذكر الإعلان الحد الأدنى من المتطلبات للاستفادة إن وجد. | هل متطلبات الاستفادة الدنيا موضحة إن وجدت؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-03-7 ↔ SA-BANK-011 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 3.7 → [3, 7] | م3 فقرة7 → [3, 7] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | أن تُشرح الرموز والاختصارات المستخدمة بلغة الإعلان. | هل الاختصارات مشروحة بلغته؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-03-8 ↔ SA-BANK-013 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 3.8 → [3, 8] | م3 فقرة8 → [3, 8] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | لمنتجات التمويل: ذكر معدل النسبة السنوي ومدة التمويل، دون نسب أخرى لتكلفة الأجل، وبيان ثبات التكلفة أو تغيرها للتمويل العقاري، ومطابقة المعدل المعتمد. | هل تظهر معدلات أخرى لكلفة الأجل؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"product_types":["personal_finance","real_estate_finance","auto_finance","credit_card","bnpl","sme_finance","consumer_microfinance","finance_lease"],"requires_product":true,"communication_types":["financial_promotion"]} | إعلان تمويل |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-03-8 ↔ SA-BANK-014 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 3.8 → [3, 8] | م3 فقرة8 → [3, 8] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | لمنتجات التمويل: ذكر معدل النسبة السنوي ومدة التمويل، دون نسب أخرى لتكلفة الأجل، وبيان ثبات التكلفة أو تغيرها للتمويل العقاري، ومطابقة المعدل المعتمد. | هل تكلفة الأجل محددة كمتغيرة أو ثابتة؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"product_types":["personal_finance","real_estate_finance","auto_finance","credit_card","bnpl","sme_finance","consumer_microfinance","finance_lease"],"requires_product":true,"communication_types":["financial_promotion"]} | تمويل عقاري |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-03-8 ↔ SA-BANK-012 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 3.8 → [3, 8] | م3 فقرة8 → [3, 8] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | لمنتجات التمويل: ذكر معدل النسبة السنوي ومدة التمويل، دون نسب أخرى لتكلفة الأجل، وبيان ثبات التكلفة أو تغيرها للتمويل العقاري، ومطابقة المعدل المعتمد. | هل معدل النسبة السنوية APR والمدة إن وجدت ظاهران؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"product_types":["personal_finance","real_estate_finance","auto_finance","credit_card","bnpl","sme_finance","consumer_microfinance","finance_lease"],"requires_product":true,"communication_types":["financial_promotion"]} | إعلان تمويل |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-03-9 ↔ SA-BANK-015 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 3.9 → [3, 9] | م3 فقرة9 → [3, 9] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | أن يتضمن الإعلان عبارة خضوع المؤسسة لإشراف البنك المركزي السعودي ورقابته (الصياغة المتوقعة يؤكدها المراجع القانوني). | هل توجد إشارة إلى إشراف البنك المركزي دون استخدام شعاره أو اسمه دعائيًا؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-04 ↔ SA-BANK-016 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 4 → [4] | م4 → [4] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | أن يوضح العرض الترويجي طريقة الاستفادة بوضوح وتاريخ بدايته ونهايته. | هل طريقة الانتفاع بالعرض واضحة مع تاريخي البداية والنهاية؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | عرض ترويجي |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-05-1 ↔ SA-BANK-017 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 5.1 → [5, 1] | م5 فقرة1 → [5, 1] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | ألا يتضمن الإعلان عروضاً أو عبارات أو ادعاءات كاذبة أو مضللة بشكل مباشر أو غير مباشر. | هل الادعاءات والأرقام مضللة أو غير صحيحة؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | hybrid |
| الحالة | draft | draft |

### SAMA-ADV-05-2 ↔ SA-BANK-018 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 5.2 → [5, 2] | م5 فقرة2 → [5, 2] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | ألا يستخدم الإعلان علامات أو حقوق ملكية فكرية للغير أو علامات مقلدة. | هل هناك تعد على الحقوق الفكرية أو علامة مزورة؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | document |
| الحالة | draft | draft |

### SAMA-ADV-05-3 ↔ SA-BANK-019 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 5.3 → [5, 3] | م5 فقرة3 → [5, 3] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | ألا يستخدم الإعلان اسم البنك المركزي أو شعاره، باستثناء عبارة الإشراف المطلوبة في 3.9. | هل استُخدمت هوية البنك المركزي بطريقة محظورة؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-05-4 ↔ SA-BANK-020 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 5.4 → [5, 4] | م5 فقرة4 → [5, 4] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | ألا يؤدي الإعلان إلى الالتباس مع منتجات أو خدمات أو أسماء أخرى. | هل يسبب الإعلان خلطًا بمنتج أو اسم آخر؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-05-5 ↔ SA-BANK-021 — Possible Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 5.5–5.6 → [5, 5] | م5 فقرة5-6 → [5, 5, 6] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | ألا يخالف الإعلان النظام العام أو الآداب أو القيم، وألا يحرض أو يثير التعصب. | هل توجد إساءة للآداب أو تحريض أو تمييز أو تعصب؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-05-8 ↔ SA-BANK-023 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 5.8 → [5, 8] | م5 فقرة8 → [5, 8] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | لا تُستخدم صور العملة السعودية أو أجزاء منها إلا بخطاب عدم ممانعة. | هل توجد موافقة لازمة لصورة العملة السعودية المتداولة؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | إذا استُخدمت صور العملة |
| نوع الفحص | — | document |
| الحالة | draft | draft |

### SAMA-ADV-06 ↔ SA-BANK-024 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 6 → [6] | م6 → [6] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | إذا كان التسعير بعملة أجنبية أو يتأثر بسعر الصرف: وجود عبارة واضحة عن أثر سعر الصرف. | هل أُدرج التحذير المقروء من تغير أسعار الصرف؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | سعر بعملة أجنبية أو منتج يتأثر بها؛ راجع صيغة المادة حرفيًا عند الاعتماد |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-07 ↔ SA-BANK-025 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 7 → [7] | م7 → [7] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | وصف المنتج بالمجاني يكون صريحاً مع بيان الفئة المستهدفة. | هل المجانية واضحة والفئة المستفيدة محددة؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | عند الادعاء بالمجانية |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-08 ↔ SA-BANK-026 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 8 → [8] | م8 → [8] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | ألا يسيء الإعلان إلى مؤسسات أخرى أو إلى القطاع، وألا ينطوي على منافسة غير عادلة. | هل يهين الإعلان المنافسين أو يضر بالمنافسة؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | content |
| الحالة | draft | draft |

### SAMA-ADV-09 ↔ SA-BANK-027 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 9 → [9] | م9 → [9] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | ألا تُستخدم بيانات العملاء الشخصية دون موافقتهم الكتابية. | هل توجد موافقة خطية لاستخدام بيانات العميل في الإعلان؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | عند استخدام بيانات عملاء |
| نوع الفحص | — | document |
| الحالة | draft | draft |

### SAMA-ADV-10 ↔ SA-BANK-028 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 10 → [10] | م10 → [10] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | ألا تُعلن منتجات الائتمان أو التأمين غير المناسبة لمن هم دون 18 عاماً لهم. | هل يستهدف الإعلان القاصرين بمنتج ائتماني أو تأميني غير مناسب؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"product_types":["personal_finance","real_estate_finance","auto_finance","credit_card","bnpl","sme_finance","consumer_microfinance","finance_lease"],"communication_types":["financial_promotion"]} | أفراد دون 18 عامًا هجريًا |
| نوع الفحص | — | document |
| الحالة | draft | draft |

### SAMA-ADV-11 ↔ SA-BANK-029 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 11 → [11] | م11 → [11] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | التزام تنظيمي: الحصول على موافقة العميل قبل إرسال الإعلانات وإتاحة إلغاء الاشتراك بسهولة. لا يُفحص في المحتوى. | هل وافق العميل على القناة المختارة ويمكنه رفض الرسائل بسهولة؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | إعلانات مرسلة للعملاء |
| نوع الفحص | — | workflow |
| الحالة | draft | draft |

### SAMA-ADV-12 ↔ SA-BANK-030 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 12 → [12] | م12 → [12] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | التزام تنظيمي: الإعلان ملزم للمؤسسة وتظهر شروطه في العقود. لا يُفحص في المحتوى. | هل تضمن العقد المزايا والمواصفات المعلن عنها؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | hybrid |
| الحالة | draft | draft |

### SAMA-ADV-13 ↔ SA-BANK-031 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 13 → [13] | م13 → [13] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | أن يكون الطرف الثالث الناشر مرخصاً من الجهة المختصة (مثل رخصة موثوق لصانع المحتوى). | هل القناة رسمية موثوقة أو الطرف الثالث مرخص؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"distribution":["influencer"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | document |
| الحالة | draft | draft |

### SAMA-ADV-14 ↔ SA-BANK-032 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 14 → [14] | م14 → [14] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | التزام تنظيمي: تحديث سياسة الإعلان كل ثلاث سنوات على الأقل. لا يُفحص في المحتوى. | هل توجد سياسة إعلانات محدثة خلال ثلاث سنوات على الأقل؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | workflow |
| الحالة | draft | draft |

### SAMA-ADV-15 ↔ SA-BANK-033 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 15 → [15] | م15 → [15] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | اعتماد إدارة الالتزام للمادة الإعلانية كتابياً قبل النشر؛ يتحقق بسجل اعتماد بشري في سَليم. | هل راجعت إدارة الالتزام الإعلان وأقرته كتابيًا قبل النشر؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | workflow |
| الحالة | draft | draft |

### SAMA-ADV-17 ↔ SA-BANK-034 — Exact Match

| | القديمة | الجديدة |
|---|---|---|
| المصدر الرسمي | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://rulebook.sama.gov.sa/en/node/1715) (sama-adv-rules-2023) | [ضوابط الإعلان عن المنتجات والخدمات المقدمة من المؤسسات المالية](https://www.sama.gov.sa/ar-sa/LawsRegulations/ConsumerProtectionRules/Rules_for_Advertising_Products_and_Services_Provided_by_Financial_Institutions-AR.pdf) (sa:SAMA) |
| حالة المصدر / التحقق | in_force / official_text_opened | unknown / official_status_unconfirmed |
| المادة | 17 → [17] | م17 → [17] |
| تاريخ النفاذ | غير متوفر | غير متوفر |
| النص (ملخص القاعدة) | التزام تنظيمي: سحب الإعلان خلال يوم عمل عند طلب البنك المركزي. لا يُفحص في المحتوى. | هل يمكن سحب إعلان مخالف خلال يوم عمل عند إخطار البنك المركزي؟ |
| النطاق والانطباق | {"sectors":["banking","finance_company","payments"],"communication_types":["financial_promotion"]} | المؤسسات المالية الداخلة في نطاق رقابة البنك المركزي |
| نوع الفحص | — | workflow |
| الحالة | draft | draft |

## قواعد CSV بلا نظير قديم (21)

تبقى مسودات وتُطبَّق فقط إذا فعّلت المنظمة مسودات الحزمة.

- SA-BANK-022 (م5 فقرة7): هل المنتج أو الخدمة غير مشروعين؟
- SA-CMA-003 (م33(ب)(3)؛ ملحق 5-1 بند12): هل أفصح الطرف الناشر عن المقابل أو المنافع؟
- SA-CMA-004 (م33(د)): هل توجد معلومات كافية لتقييم الاستثمار؟
- SA-CMA-007 (م34(ب)): هل توجد موافقة المتلقي أو علاقة عميل قائمة يتوقع معها هذا الإعلان؟
- SA-CMA-008 (م34(ج)(3)): هل عُرف المتصل والمؤسسة والغرض في بداية الاتصال؟
- SA-CMA-009 (م34(ج)(4)): هل توجد موافقة مسبقة على الاتصال خارج الدوام؟
- SA-CMA-011 (ملحق 5-1 بند1): هل هدف الإعلان ظاهر؟
- SA-CMA-012 (ملحق 5-1 بند2): هل نوع النشاط والأداة المالية مفهوم؟
- SA-CMA-013 (ملحق 5-1 بند3): هل كُشفت افتراضات الوعود والتوقعات المشروطة؟
- SA-CMA-016 (ملحق 5-1 بند5): هل يظهر اسم المؤسسة وعنوانها ووضع ترخيص الهيئة؟
- SA-CMA-017 (ملحق 5-1 بند6): هل وصف الضمان مدعوم باتفاق ملزم مع طرف ثالث وتفاصيل كافية؟
- SA-CMA-018 (ملحق 5-1 بند7): هل المقارنة موثقة أو معللة ومتوازنة وتضم الحقائق الجوهرية؟
- SA-CMA-019 (ملحق 5-1 بند8): هل أُفصح عن المصالح الاستثمارية ذات الصلة والخدمات المهمة في آخر 12 شهرًا عند تحققها؟
- SA-CMA-020 (ملحق 5-1 بند9): هل بيانات الأداء التاريخي عادلة وغير منتقاة للتضخيم وقابلة للتحقق؟
- SA-CMA-023 (ملحق 5-1 بند10): هل توضح افتراضات الزكاة والضريبة والإعفاء واحتمال تغيرها؟
- SA-CMA-024 (ملحق 5-1 بند11): هل توضح حقوق الإلغاء ومهلتها؟
- SA-CMA-025 (ملحق 5-1 بند13): هل أُبرز احتمال هبوط القيمة أو الدخل وخسارة رأس المال حيث يلزم؟
- SA-CMA-026 (ملحق 5-1 بند14): هل ذُكر أن التوصية قد لا تناسب الجميع وضرورة الرجوع للمستشار عند الشك؟
- SA-CMA-027 (ملحق 5-1 بند15): هل توضّح مخاطر الخسارة المفاجئة واحتمال تجاوز رأس المال بحسب الحالة؟
- SA-CMA-028 (ملحق 5-1 بند16): هل يُبيّن تغير الدخل أو احتمال دفعه من رأس المال بحسب الحالة؟
- SA-CMA-029 (ملحق 5-1 بند17): هل يوجد تحذير من أثر تغير سعر الصرف؟

## ما يحدث بعد اعتمادك

1. لكل زوج تعلّمه «Verified Equivalent»: تبقى القاعدة القديمة إن كانت سارية، وتُؤرشف الجديدة المكررة، أو العكس حسب قرارك، في migration منفصل تراجعه.
2. «ليست مطابقة»: يُزال علم التكرار عن القاعدة الجديدة فتعود مسودة عادية.
3. لا تصبح أي قاعدة «سارية» إلا بعد المراجعة القانونية وإصدار جديد ينشره مشرف المنصة.

المراجع: ______________  التاريخ: ________  التوقيع: ______________
