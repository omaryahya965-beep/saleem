# SALEEM — 3-minute demo script

Audience: judges / investors / a brand partner. Language: Arabic UI (switch to English once at the end).
Device: laptop (1440 px) with a phone on standby to show the mobile layout.

Uses the seeded demo pair — real pipeline output on **synthetic** Saudi-dialect clips (TTS + slides),
clearly labelled «مقطع اصطناعي للعرض». No sign-in needed.

| Demo item | URL |
|---|---|
| Needs-fixes report | `/checks/d0000000-0000-0000-0000-000000000003` |
| Fixed version (ready) | `/checks/d0000000-0000-0000-0000-000000000004` |
| Compliance log | `/checks/d0000000-0000-0000-0000-000000000004/log` |
| Public verification | `/verify/d0000000-0000-0000-0000-000000000004` |

## 0:00 – 0:20 · The problem (landing `/`)
"Saudi creators publish ads daily. One missing «إعلان» or one 'guaranteed weight loss' line can cost a
Mawthooq license. SALEEM checks **before** you publish — «افحص قبل أن تنشر»."
- Click a marker on the mini-report timeline: the issue card changes. "That's the whole product in one card."
- Click **شاهد تقريراً جاهزاً**.

## 0:20 – 1:20 · The report (needs fixes)
- Point at the status band: **يحتاج تعديلات**, "3 violations and 3 warnings", the model and rulebook version.
  "Status in under three seconds."
- Click the **COM-01 card at 00:08** → the timeline jumps and the transcript line highlights.
  "Saudi dialect, transcribed with timestamps: «ينحف وتنزلين 5 كيلو في أسبوع، ومضمون بدون أعراض جانبية»."
- Point at the second COM-01 at 00:12: "Same claim, but **on screen** — read from the video frame."
- MAW-01: "Discount code SLIM50 and no «إعلان» in the first five seconds."
- Each card: rule code, official source link, evidence, and a concrete fix.
- Footer: «تنبيهات استرشادية وليست موافقة رسمية» — "We help creators comply; we don't police them."

## 1:20 – 2:00 · Re-check → ready
- Click **ارفع النسخة المعدّلة** to show the re-check form (prefilled, linked to the previous version) — don't submit.
- Open the fixed version (`…0004`): **جاهز للنشر**.
- «ما تم إصلاحه»: every previous issue struck through, rule by rule, with a link back to the old report.

## 2:00 – 2:40 · Compliance log + verification
- **سجل الامتثال** → A4 sheet: verification ID, SHA-256 of the file, rulebook version, model, QR.
  Click **حفظ PDF** to show the print dialog (cancel).
- Scan the QR with the phone (or open `/verify/…0004`): **سجل أصلي ولم يُعدَّل** — "Anyone — a brand, an
  agency — can check it's authentic and unchanged, without seeing the content."

## 2:40 – 3:00 · Close
- Toggle **English**: the whole UI mirrors to LTR.
- Show the phone: same report, player on top, sticky action bar.
- "Agencies get workspaces, campaigns and brand approval links; we measure accuracy per rule —
  100 % recall / 94 % precision on our Saudi-dialect test set, about half a cent per check."

## Backup answers
- *Is this legal advice?* No — advisory, illustrative rules pending legal review; the creator decides.
- *Privacy?* Video and frames deleted after 24 h; only findings and a fingerprint remain; never shared.
- *Real creators' clips?* Pipeline is ready (`npm run clips`); the demo uses synthetic clips until
  creators' consented clips are added.
- *Cost?* Measured $0.006–0.03 per check (model + transcription), logged per run.
