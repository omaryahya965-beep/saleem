# 05 — UX specification

SALEEM keeps its own visual identity and existing design system (`frontend/src/components/ui`, Tailwind
tokens, Radix primitives, local Arabic fonts). Extend it; do not imitate any vendor's colours, icons,
illustrations or layouts.

## 1. Information architecture

Sidebar (start side = right in Arabic), collapsible, role-aware. Org switcher at the top (personal space
for creators without an org).

| Item (ar) | Route | Who sees it | Phase |
|---|---|---|---|
| الرئيسية | `/` (inside `_app`) | everyone | 5 (simple version in 1) |
| الإعلانات | `/promotions` | everyone | 1 |
| إعلان جديد (button) | `/new` | uploaders | 1 |
| طابور المراجعة | `/queue` | reviewer, admin, owner | 3 |
| المنتجات | `/products` | admin, owner (read: members) | 1 |
| الادعاءات | `/claims` | members | 5 |
| القواعد | `/rulebook` | everyone (details: admins) | 2 (extends existing) |
| الإفصاحات | `/disclaimers` | admin, owner | 5 |
| التحليلات | `/analytics` | admin, owner | 6 |
| سجل التدقيق | `/audit` | admin, owner | 3 |
| الإعدادات | `/settings/*` | members (org sections: admin, owner) | 1→6 |

Keep: `/checks/$id` (redirect to `/promotions/<promotion_id>?v=<version_no>`), `/verify/$id`, share
routes, `/sample`, auth, legal, landing, admin, archive (redirect to `/promotions?status=archived` once
the list covers it).

## 2. Promotion page (`/promotions/$id?v=N`)

Desktop layout uses logical properties so it mirrors in English:

```
┌ header: title (editable in draft) · version switcher V1..Vn · review status badge · automated
│         result chip · coverage chip · deadline · product · channels · primary action button
├───────────────────────────────────────────┬───────────────────────────────┐
│ Asset viewer (inline-start, ~60%)          │ Side panel (inline-end, ~40%)  │
│  video: player + timeline with markers     │ tabs: الملاحظات · التعليقات ·  │
│  image: zoom/pan + pins                    │ المعلومات · السجل · المقارنة   │
│  text: highlighted ranges                  │                               │
│  pdf (P4): pages, thumbnails, pins         │                               │
└───────────────────────────────────────────┴───────────────────────────────┘
```

Mobile (≤ 640 px): asset on top, panel below as tabs; sticky action bar at the bottom.

**Primary action** depends on role and status: «إرسال للمراجعة» (uploader, draft-like states),
«بدء المراجعة» (reviewer, pending), «القرار» menu (reviewer, in review), «رد على التصعيد» (legal),
«رفع إصدار جديد» (uploader after changes/rejection/conditional). Disabled buttons show the server
preflight reasons (`can_submit`, `can_decide`) in a tooltip and an inline list.

### 2.1 Findings tab

- Coverage banner first: «تغطية كاملة» or «تغطية جزئية» with the list of gaps.
- Group by finding type (order: تعارض مؤكد · معلومة إلزامية ناقصة · خطر تنظيمي محتمل · يحتاج دليلاً ·
  تعذّر التحقق), then by severity.
- Finding card: type badge · severity · rule code + Arabic title · article + source link with a
  verification badge (رسمي / يحتاج تأكيداً / ثانوي) · draft-rule label if any · evidence (quote with
  `<bdi>`, timestamp chip, blurred thumbnail, page) · «أين؟» locate button · explanation · missing
  information · suggested fix with copy button · carried-from badge «من الإصدار 1» · status · response
  buttons for the caller's role · response history.
- Collapsible «قواعد لم تنطبق (n)» with reasons, and «تعذّر التحقق (n)».

### 2.2 Comments tab (Phase 4)

Threads, mentions (`@` picker of org members), anchors (click the asset in comment mode), filters
(open/resolved, mine, change requests), drafts kept in `localStorage` (try/catch), «أين؟» locate.

### 2.3 Info tab

Context fields, product facts used, linked claims (P5), required disclaimers (P5), reviewer notes,
assignment, deadline, share links (existing), compliance log link (existing).

### 2.4 History tab

Timeline from review events + decisions: who, what, when (Hijri and Gregorian), reasons, conditions,
decision hash (short) with «تحقق من سلامة السجل» (calls `verify_decision_chain`).

### 2.5 Compare tab (Phase 4)

Pick two versions: side-by-side assets (synchronised for video by time), caption/transcript diff, findings
diff (أُصلح · بقي · جديد), reviewer requests status.

## 3. Other screens

- **New promotion (`/new`)**: step 1 upload (as today); step 2 context (product select with "بدون منتج",
  channels multi-select, communication type, audience, paid, distribution + Mawthooq licence field when
  influencer, deadline, caption, reviewer notes). Personal creators see the short form (today's fields).
  Show existing size/duration limits from `lib/media.ts`.
- **Promotions list**: columns — العنوان · المنتج · القنوات · حالة الاعتماد · النتيجة الآلية · الإصدار ·
  المراجع · الموعد · آخر تحديث. Filters (AND): status, product, channel, communication type, reviewer
  (incl. «غير مُسنَد»), uploader, deadline range, tags, overdue. Search by title/ID. Saved views (P5).
  Export CSV (P5).
- **Review queue**: tabs «مُسنَد إليّ» · «غير مُسنَد» · «عاد من التصعيد» · «الكل». Sort by deadline;
  overdue badge when past deadline or SLA (business days, Sun–Thu).
- **Products**: list + form for key facts (APR value/type, term range, fees list, requirements, target
  customers, Sharia flag/reference), status draft → approved (admin), versions read-only after approval.
- **Rulebook**: packs → rules; rule detail shows summary, applicability in readable Arabic, check type,
  deterministic key, model instruction (admins), article and source with verification, review state,
  changelog. Org admins toggle packs and «تضمين القواعد قيد المراجعة» (Phase 2 read-only + toggles).
- **Audit log**: filter by event type, actor, promotion, date; export CSV (admins).
- **Settings**: organisation (sector, brand aliases), members and roles (+ legal), review settings (SLA,
  response requirements), rejection reasons (P3), retention (P3), notifications (P3).

## 4. States and feedback

Every screen and async widget has: empty (what to do next), loading (skeletons, never spinners alone for
> 1 s), error (Arabic message from `code:*`, retry when safe, support code), success (only after the
server confirms). Long operations (analysis) show real progress from `progress`/`current_step`.

## 5. RTL, numbers, dates

- Use logical utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`) — no `left/right`
  in new code.
- Wrap numbers, percentages, codes, URLs, file names and Latin terms inside Arabic text with `<bdi>`.
- UI digits: keep the current app convention (record it in DECISIONS); parsing accepts both digit sets.
- Dates: `Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura')` for Hijri + Gregorian side by side in
  history, decisions and certificates.
- Saudi riyal sign: use U+20C1 only with a font that has the glyph; fallback «ر.س». Test both.
- Test every new screen in Arabic and English, desktop and 375 px.

## 6. Arabic copy glossary (add to `ar.json`/`en.json`)

### 6.1 Review status

| key | ar | en |
|---|---|---|
| draft | مسودة | Draft |
| pending_review | بانتظار المراجعة | Pending review |
| in_review | قيد المراجعة | In review |
| changes_requested | طُلبت تعديلات | Changes requested |
| conditionally_approved | معتمد بشرط | Conditionally approved |
| approved | معتمد | Approved |
| rejected | مرفوض | Rejected |
| escalated | مُصعَّد للقانوني | Escalated to legal |
| withdrawn | مسحوب | Withdrawn |
| archived | مؤرشف | Archived |

### 6.2 Analysis status and automated result

| key | ar | en |
|---|---|---|
| queued | في الانتظار | Queued |
| processing | جارٍ التحليل | Analysing |
| done | اكتمل التحليل | Analysis complete |
| failed | تعذّر التحليل | Analysis failed |
| cancelled | أُلغي | Cancelled |
| ready | لا ملاحظات آلية | No automated findings |
| review | ملاحظات للمراجعة | Findings to review |
| needs_fixes | ملاحظات تستلزم التعديل | Findings that require changes |
| coverage_complete | تغطية كاملة | Full coverage |
| coverage_partial | تغطية جزئية | Partial coverage |
| advisory | هذه نتيجة فحص آلي استرشادي، والاعتماد قرار يتخذه مسؤول مخوّل. | This is an advisory automated result; approval is a decision made by an authorised person. |

### 6.3 Finding types and rule outcomes

| key | ar | en |
|---|---|---|
| confirmed_mismatch | تعارض مؤكد مع بيانات معتمدة | Confirmed mismatch |
| potential_risk | خطر تنظيمي محتمل | Potential regulatory risk |
| missing_required | معلومة إلزامية ناقصة | Missing required information |
| needs_evidence | يحتاج دليلاً داعماً | Needs supporting evidence |
| unable_to_verify | تعذّر التحقق | Unable to verify |
| passed | لا ملاحظة | No issue found |
| not_applicable | لا تنطبق | Not applicable |
| rule_draft | قاعدة قيد المراجعة القانونية | Rule pending legal review |

### 6.4 Responses

| key | ar | en |
|---|---|---|
| agree_will_action | موافق، سأعدّل | Agree, will fix |
| dispute | أعترض | Dispute |
| reply | ردّ | Reply |
| agree_please_action | موافق، يلزم التعديل | Agree, fix required |
| not_required | صحيحة لكن غير مطلوبة هنا | Valid, not required here |
| dismiss | غير صحيحة | Dismiss as incorrect |

### 6.5 Decisions

| key | ar | en |
|---|---|---|
| approve | اعتماد | Approve |
| conditional_approve | اعتماد بشرط | Approve with condition |
| request_changes | طلب تعديلات | Request changes |
| reject | رفض | Reject |
| escalate | تصعيد للقانوني | Escalate to legal |
| legal_response | رد القانوني | Legal response |

### 6.6 Default rejection / change reasons (platform defaults, editable per org in P3)

| ar | en |
|---|---|
| معلومة إلزامية ناقصة | Missing mandatory information |
| ادعاء غير مثبت | Unsubstantiated claim |
| رقم أو سعر غير مطابق | Incorrect figure or price |
| إفصاح غير واضح أو غير بارز | Unclear or non-prominent disclosure |
| لغة مبالغة أو مضللة | Exaggerated or misleading language |
| مخالفة لسياسة داخلية | Internal policy breach |
| جودة الملف لا تسمح بالمراجعة | File quality prevents review |
| أخرى | Other |

### 6.7 Copy rules

- Formal, concise Modern Standard Arabic; no exclamation marks in system copy.
- Never: «متوافق 100%», «مطابق للأنظمة», «معتمد من البنك المركزي», «approved by SAMA», "compliant".
- Use «الفحص الآلي» for the AI, «المراجع» for the human reviewer, «الاعتماد» only for human decisions.
- Rule references: «المادة 3.8 من ضوابط الإعلان (البنك المركزي السعودي)».

## 7. Accessibility

Radix primitives for dialogs, menus, tabs, tooltips; visible focus; keyboard: `J/K` move between findings,
`L` locate, `Enter` open; colour is never the only signal (icons + text); contrast AA; `aria-live` for
analysis progress; Arabic `aria-label`s. Add an axe check to Playwright for the new pages if
`@axe-core/playwright` is accepted (dev dependency).
