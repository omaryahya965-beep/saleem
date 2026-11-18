# Phase 4 plan — Comments, version compare, PDF

## Discovery
- The report view (`ReportView` + `MediaPanel` + `VideoTimeline`) is shared with the public demo and the compliance log;
  comments get their own tab instead of a rewrite of the media components (D115).
- `frames.t_seconds` is NOT NULL → PDF pages store the page number there and in `page_no` (D114).
- Bucket MIME list lacks PDF/JSON → widened in M7.
- `pdfjs-dist@4.10.38` (pre-approved) builds with Vite 8/rolldown; its worker is emitted as a lazy asset.
- `diff` not added: a small LCS word diff with tests is enough (D116).

## Slices
1. Enum `pdf`; M7 comments (RPCs, mentions, change-request carry-forward, decision notes), frame page columns. pgTAP.
2. `analyze` PDF branch (pages, text layer, model OCR, `pdf_pages` coverage, unreadable → unable_to_verify) + case 10.
3. Frontend: PDF extraction + upload; comments tab; compare tab; collab helpers + tests.
4. Gate, report.
