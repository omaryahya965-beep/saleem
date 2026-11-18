// PDF extraction in the browser (Phase 4): each page rendered to JPEG (≤ 1600 px wide) plus its text layer.
// pdfjs-dist is loaded on demand so it never weighs on other pages.

export const MAX_PDF_PAGES = 30;
export const PDF_PAGE_MAX_WIDTH = 1600;

export interface PdfPage {
  page: number;
  blob: Blob;
  /** Text layer of the page ("" for scanned pages; the model reads those). */
  text: string;
}

export interface PdfExtraction {
  pages: PdfPage[];
  totalPages: number;
  /** True when the document has more than MAX_PDF_PAGES pages (only the first ones are checked). */
  truncated: boolean;
}

/** Joins pdf.js text items into lines (items carry `str` and `hasEOL`). */
export function joinTextItems(items: { str?: string; hasEOL?: boolean }[]): string {
  return items
    .map((i) => (i.str ?? "") + (i.hasEOL ? "\n" : " "))
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Scale that keeps the rendered width ≤ PDF_PAGE_MAX_WIDTH (never upscales beyond 2×). */
export const renderScale = (pageWidth: number) =>
  Math.min(2, PDF_PAGE_MAX_WIDTH / Math.max(1, pageWidth));

export async function extractPdf(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<PdfExtraction> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const total = doc.numPages;
  const count = Math.min(total, MAX_PDF_PAGES);
  const pages: PdfPage[] = [];
  for (let n = 1; n <= count; n++) {
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: renderScale(base.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("render failed"))),
        "image/jpeg",
        0.82,
      ),
    );
    const content = await page.getTextContent();
    pages.push({
      page: n,
      blob,
      text: joinTextItems(content.items as { str?: string; hasEOL?: boolean }[]),
    });
    onProgress?.(n, count);
  }
  await doc.destroy();
  return { pages, totalPages: total, truncated: total > MAX_PDF_PAGES };
}
