# Phase 4 — Comments, version compare, PDF (P1)

**Goal:** reviewers and marketers talk *on the asset* (pinned comments, mentions, change requests),
changes are traceable across versions, and PDF brochures can be analysed and reviewed.

**User problem:** feedback today lives outside SALEEM (chat, email), so it is lost between versions; bank
material is often PDF.

**Preconditions:** Phase 3 accepted. Read `03_DATA_MODEL.md` M7, `04_AI_PIPELINE.md` §8 and §11,
`05_UX_SPEC.md` §2.2 and §2.5.

## 4.1 Discovery

- `components/ui/VideoTimeline` and the report's media components; how frames and timestamps are shown.
- `lib/extract.ts` (frames/audio extraction) and `lib/media.ts` (limits) to plan PDF extraction.
- Whether `pdfjs-dist` works with the Vite 8/rolldown build (try a minimal import in a branch).

## 4.2 Tasks

1. **Migration M7** + rollback: `comments` (RLS: read by promotion readers; `visibility = 'external'`
   reserved for Phase 6), `frames.page_no`, `pdf` kind.
2. **AssetViewer** (`components/ui/asset-viewer/*`): shared zoom/pan, anchors, «أين؟» locate API;
   adapters for video (existing timeline + markers for findings and comments), image (pins at ratio
   coordinates), text (highlighted ranges by character offsets on the normalised caption), PDF (page
   thumbnails, page navigation, in-document search on the text layer, pins). Keyboard support.
3. **Comments panel**: threads, replies, `@` mentions (org members), kinds (`general`, `change_request`
   — reviewers only, `decision_note` — system after decisions), resolve/unresolve (reviewer/owner),
   edit within 15 minutes, soft delete, drafts in `localStorage` with try/catch, filters.
4. **Mentions → notifications** (in-app + email per preferences).
5. **Carry-forward UI**: findings carried from the previous version show «من الإصدار N»; open
   `change_request` comments are carried to the new version (`carried_from_comment_id`) until a reviewer
   resolves them; general comments stay on their version; replies on older versions are read-only.
6. **Compare tab**: choose two versions; side-by-side assets (synchronised video time; same PDF page);
   caption/transcript word-level diff (`diff` package if approved, else a small LCS utility with tests);
   findings diff (أُصلح · بقي · جديد) from `resolved_in_submission_id` / `carried_from_finding_id`.
7. **PDF pipeline**:
   - Browser: render pages to JPEG (max width 1600 px, cap pages at 30 and show a clear limit message),
     extract the text layer per page, compute sha256 of the original; upload original + page images.
   - Store pages as `frames` with `page_no` and `t_seconds = null`; store page text in `ocr_text` (or a
     dedicated column if clearer) with a flag for text-layer vs model OCR.
   - `analyze`: PDF branch (no transcription); model gets page images + text layer; evidence references
     `page`; coverage `pdf_pages` per `04_AI_PIPELINE.md` §8; pages without text layer rely on model OCR;
     unreadable pages → `unable_to_verify` for dependent rules.
   - Viewer and findings locate to the page and region.
8. **i18n**, empty states («لا تعليقات بعد — حدّد موضعاً في الإعلان وأضف تعليقك»).

## 4.3 Tests

- RLS for comments (outsider, org member, external visibility reserved).
- Anchor math (ratios on resize, text offsets after normalisation).
- Carry-forward of change requests and findings across V1→V2→V3.
- PDF extraction unit tests with fixtures (text PDF, scanned PDF) and pipeline test for case 10.
- E2E: reviewer pins a change request on an image and on a video time; creator uploads V2; request shows
  as carried; reviewer resolves; compare tab shows the diff. Case 11.

## 4.4 Acceptance criteria

- [ ] Comments can be pinned on image, video, text and PDF and located from the panel.
- [ ] Mentions notify; change requests carry forward until resolved; replies on old versions read-only.
- [ ] Compare shows asset, text and findings differences between any two versions.
- [ ] PDF ads are analysed with page-level evidence; scanned pages never yield «لا ملاحظات آلية»
      when unreadable.
- [ ] Gate checks pass; report written; PROGRESS updated.

## 4.5 Out of scope

External partner comments (Phase 6), Office documents and website capture (Phase 7 if ever).
