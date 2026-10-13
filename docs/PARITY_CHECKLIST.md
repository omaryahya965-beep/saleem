# SALEEM — Parity Checklist

> Every screen, flow, and user action that must work identically after migrating from Lovable Cloud to Local Supabase.  
> Branch: `migrate-supabase`

---

## Status Legend
- [ ] **Pending**: Not yet verified against local backend
- [x] **Passed**: Verified and working identically to baseline

---

## 1. Authentication & Session Management

| ID | Test Item | Steps | Expected Result | Status |
|:---|:---|:---|:---|:---:|
| AUTH-01 | **Login with valid credentials** | Navigate to `login` screen, enter `demo@saleem.app` / `demo123456`, click "تسجيل الدخول" | Successfully logs in, stores JWT session in local storage, redirects to `dashboard` | [ ] |
| AUTH-02 | **Try the Demo Account** | On `login` screen, click "جرّب الحساب التجريبي" | Logs in as demo user automatically without password prompt and opens the demo report | [ ] |
| AUTH-03 | **Session Persistence** | Refresh the browser while authenticated | User session remains intact; does not kick user back to login screen | [ ] |
| AUTH-04 | **Sign Out / Avatar Action** | Click avatar icon "م" in the top bar | Opens account details or signs out, clearing session token | [ ] |

---

## 2. Landing Page & Public Demo Flow

| ID | Test Item | Steps | Expected Result | Status |
|:---|:---|:---|:---|:---:|
| LND-01 | **Landing Page Hero & Copy** | Open `/` in logged-out state | Hero displays «افحص قبل أن تنشر», sample preview card, and step-by-step explainer with RTL layout | [ ] |
| LND-02 | **Direct Demo Access** | Click "شاهد تقريراً جاهزاً" on landing page | Navigates immediately to the "Needs Fixes" demo report (`d0000000-0000-0000-0000-000000000001`) with all findings loaded | [ ] |
| LND-03 | **Zero-Config Demo Mode** | Run app without external AI API keys | Demo reports load instantly with full mock findings and transcripts without throwing errors | [ ] |

---

## 3. New Check Submission (`new`)

| ID | Test Item | Steps | Expected Result | Status |
|:---|:---|:---|:---|:---:|
| SUB-01 | **Content Kind Selection** | Select "فيديو", "صورة", or "نص فقط" | Active segmented button changes styling and updates accepted dropzone formats | [ ] |
| SUB-02 | **File Dropzone & Validation** | Drag & drop or select video file (> 25MB or > 90s) | Validation warning prevents upload if file exceeds limits; valid file shows selected state | [ ] |
| SUB-03 | **Metadata & Form Fields** | Fill caption, select platform (Snapchat), category (الصحة واللياقة) | Form state updates correctly; toggle switches animate between on/off states | [ ] |
| SUB-04 | **Policy Toggles** | Toggle "هذا إعلان مدفوع", "لدي عقد مكتوب", "استخدمت الذكاء الاصطناعي" | Switch state is saved and passed as metadata to the submission record | [ ] |
| SUB-05 | **Start Check Submission** | Click "ابدأ الفحص" with valid inputs | Frame extraction and SHA-256 calculation execute client-side; media uploads to `media` bucket; submission record is created; redirects to `processing` | [ ] |

---

## 4. Processing Pipeline Screen (`processing`)

| ID | Test Item | Steps | Expected Result | Status |
|:---|:---|:---|:---|:---:|
| PRC-01 | **Step Progression Display** | Observe screen during analysis | Displays progress bar (0% -> 100%) and updates step list: رفع الملف -> استخراج اللقطات -> تفريغ الكلام -> مطابقة القواعد -> إعداد التقرير | [ ] |
| PRC-02 | **Realtime / Polling Synchronization** | Monitor network activity | Subscribes to Supabase Realtime channel or polls `/submissions/{id}` every 2s; reflects backend state changes | [ ] |
| PRC-03 | **Completion Transition** | Analysis reaches 100% | Button changes to "عرض التقرير"; clicking navigates to the generated `report` screen | [ ] |
| PRC-04 | **Simulation Fallback** | Click "محاكاة اكتمال الفحص" during offline/demo mode | Advances simulated progress to 100% and allows opening the ready report | [ ] |

---

## 5. Report Screen: Needs Fixes (`report`)

| ID | Test Item | Steps | Expected Result | Status |
|:---|:---|:---|:---|:---:|
| REP-01 | **Status Band & Counter** | View report for submission 1 | Red status band displays "يحتاج تعديلات" with finding count (e.g., "وجدنا 2 مخالفة و3 تنبيهات") | [ ] |
| REP-02 | **Video Player & Markers** | Inspect video timeline bar | Timeline displays colored dot markers (red for violations, amber for warnings) at exact finding seconds | [ ] |
| REP-03 | **Interactive Timestamp Seeking** | Click finding at 00:12 (e.g. CNT-01) or click its marker on the timeline | Video jumps to 00:12; player timestamp updates; finding card highlights as active | [ ] |
| REP-04 | **Finding Details Display** | Expand or inspect any finding card | Displays rule code (`MAW-01`), rule name, legal source link, evidence snippet, and suggested fix | [ ] |
| REP-05 | **Speech Transcript Accordion** | Click "النص المستخرج من الكلام" | Expands transcript accordion showing Arabic segments with timestamps (00:00, 00:21, etc.) | [ ] |
| REP-06 | **Re-check Action** | Click "رفع النسخة المعدّلة" | Navigates to `new` with `parent_id` pre-filled, preserving association with previous submission | [ ] |
| REP-07 | **View Compliance Log** | Click "سجل الامتثال" | Navigates to `log` screen for this submission | [ ] |

---

## 6. Report Screen: Ready to Publish (`ready`)

| ID | Test Item | Steps | Expected Result | Status |
|:---|:---|:---|:---|:---:|
| RDY-01 | **Green Status Band** | View report for submission 2 | Green banner displays "جاهز للنشر" and "لم نجد مخالفات أو تنبيهات بعد مراجعة 12 قاعدة" | [ ] |
| RDY-02 | **Fixed Items Comparison** | Review checklist on ready screen | Displays list of items resolved compared to the previous version with green checkmarks | [ ] |
| RDY-03 | **Link to Previous Version** | Click "النسخة السابقة: يحتاج تعديلات" | Navigates back to parent report screen (`d0000000-...-000000000001`) | [ ] |
| RDY-04 | **Download Log Action** | Click "تنزيل سجل الامتثال" | Navigates to `log` screen with ready stamp | [ ] |

---

## 7. Compliance Log Sheet (`log`)

| ID | Test Item | Steps | Expected Result | Status |
|:---|:---|:---|:---|:---:|
| LOG-01 | **Certificate Header & Metadata** | View `log` screen | Displays official certificate layout: SLM number, title, platform, date, SHA-256 hash, and rulebook version | [ ] |
| LOG-02 | **Ready Stamp & Table** | Inspect table content | Shows "جاهز للنشر" stamp and summary table of all evaluated rules and their resolved status | [ ] |
| LOG-03 | **Print / Export PDF** | Click "حفظ PDF" | Triggers browser `window.print()` dialog with clean print styling (no topbar, A4 format) | [ ] |
| LOG-04 | **Back Link Navigation** | Click "العودة إلى التقرير" | Returns back to the active report screen | [ ] |

---

## 8. Rulebook Screen (`rules`)

| ID | Test Item | Steps | Expected Result | Status |
|:---|:---|:---|:---|:---:|
| RUL-01 | **Rule Listing & Version** | Navigate to `rules` screen | Displays version badge ("الإصدار 2026.10-أ، توضيحي بانتظار المراجعة القانونية") and 12 seed rules | [ ] |
| RUL-02 | **Category Filtering** | Click tabs: "الكل", "الإعلانات", "المحتوى", "الشفافية" | Filters rules to only show those belonging to the selected category | [ ] |
| RUL-03 | **Search Query** | Type "قاصر" or "MAW" into search bar | Filters rule items dynamically by code, title, and description | [ ] |
| RUL-04 | **Source Attribution** | Click "المصدر" link on any rule | Points to correct external regulatory reference URL (e.g. GCAM / Mawthooq) | [ ] |

---

## 9. Dashboard (`dashboard`)

| ID | Test Item | Steps | Expected Result | Status |
|:---|:---|:---|:---|:---:|
| DSH-01 | **Submission List View** | Navigate to `dashboard` screen | Lists all user submissions with thumbnail, title, platform, date, and colored status chips | [ ] |
| DSH-02 | **Status Filter Tabs** | Click tabs: "الكل", "يحتاج تعديلات", "يحتاج مراجعة", "جاهز للنشر" | Correctly filters displayed items by overall status | [ ] |
| DSH-03 | **Open Submission** | Click any submission row | Navigates directly to that submission's report screen | [ ] |
| DSH-04 | **New Check Shortcut** | Click "فحص جديد" button on dashboard | Navigates to `new` upload screen | [ ] |

---

## 10. Data Protection & Media Lifecycle

| ID | Test Item | Steps | Expected Result | Status |
|:---|:---|:---|:---|:---:|
| SEC-01 | **Signed Media URLs** | Inspect video `<source src>` URL | Media is fetched via private, short-lived signed URLs from Supabase Storage; direct unsigned URLs are blocked | [ ] |
| SEC-02 | **RLS User Isolation** | Query another user's submission ID | Returns 404 / 0 rows; users cannot view other creators' private submissions | [ ] |
| SEC-03 | **24-Hour Media Deletion** | Run media cleanup job after 24 hours | Original media file is deleted from `media` storage bucket; submission `media_deleted_at` is set; findings, transcripts, and SHA-256 hash remain fully intact | [ ] |
