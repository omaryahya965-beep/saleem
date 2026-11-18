# Phase 4 report — Comments, version compare, PDF
Date: 2026-11-18 · Branch: v2/full-run · Commits: 44fe975..(tag v2-phase-4)

## Outcome
Reviewers and uploaders now discuss the ad inside SALEEM: comments pinned on an image or PDF page, at a video second or
on text, with replies, @mentions (notified), change requests that carry forward to the next version until a reviewer
resolves them, decision notes, edits within 15 minutes and soft delete; earlier versions are read-only. A Compare tab
shows two versions side by side with word-level caption/transcript diffs and findings fixed / still present / new.
PDF brochures (≤ 30 pages) can be uploaded: pages are analysed with page-level evidence, the text layer where present
and model OCR otherwise; unreadable pages make coverage partial and never yield «لا ملاحظات آلية».

## Acceptance criteria
| Criterion | Status | Evidence |
|---|---|---|
| Comments pinned on image, video, text and PDF and located from the panel | partly | image/PDF-page pins + video second + text anchors stored and validated (`valid_anchor`, `collab.test.ts`); «أين؟» highlights the pin in the comments preview, not in the report player (D115) |
| Mentions notify; change requests carry forward until resolved; old versions read-only | met | `p4_comments.test.sql` |
| Compare shows asset, text and findings differences | met | `CompareTab`, `collab.test.ts` (case 11 findings diff) |
| PDF analysed with page evidence; unreadable pages never «لا ملاحظات آلية» | met (mocked model) | `rules-v2.test.ts` case 10; analyze PDF branch (deno check) |
| Gate, report, PROGRESS | met | below |

## Tests
- Added: pgTAP `p4_comments`; Vitest `collab` (7), case 10 in `rules-v2`.
- Gate: lint ✓ (0 errors) · typecheck ✓ · unit ✓ (77 + 127) · deno check ✓ · db reset **not run** (PGlite ✓) ·
  build ✓ · e2e ✓ 24/24 offline · e2e for pins/carry/compare **not run**.
- Note: one e2e run in this phase was started without the offline `VITE_SUPABASE_URL`; the mock's passthrough may
  have sent anonymous read requests (public rules/demo rows) to the hosted project. No writes; re-run offline green.

## Not done / deviations
- No zoom/pan asset viewer or in-document PDF search; pins use the first-page preview with a page number (D115).
- PDF extraction has no fixture-based test in CI (pdf.js needs a canvas); helpers are unit-tested, the browser path
  must be checked manually with a text PDF and a scanned PDF.
- D113–D118.

## How to verify manually
1. «إعلان جديد» → «ملف PDF» → upload a 3-page text PDF → findings cite «صفحة».
2. Upload a scanned PDF → «تغطية جزئية» if a page is unreadable; no «معلومة إلزامية ناقصة» from fixed checks.
3. «التعليقات» → «تثبيت على المحتوى» → click the image → «طلب تعديل» with @mention → the mentioned member gets a notification.
4. Upload V2 → the change request shows «من الإصدار 1»; reviewer «حلّ».
5. «المقارنة» → V1 vs V2 → word diff and «أُصلح / بقي / جديد».
