# Live Gemini run — 2026-11-22 (isolated stack, owner-authorised, free tier)

This run used the real Gemini key on the isolated stack (`saleem_iso`) and the configured model `gemini-3.6-flash`
(confirmed by `models.list`). The owner authorised at most 10 requests. **8 were sent.**

During the run, 503 overload retries were disabled in the stack's copy of the functions, so each call was limited
to the code's two-attempt cap. No call needed a second attempt (`llm_attempts = 1` everywhere, and the logs show no
`gemini_overload_retry` or `schema_v2_invalid` events). Free tier, so the cost was $0. At paid prices the recorded
estimate is about $0.085.

| # | Request | Result |
| - | --- | --- |
| 1 | Studio script (`studio`) | 4 scenes, disclosures «إعلان مدفوع» and «محتوى معدّ بمساعدة الذكاء الاصطناعي» |
| 2–3 | Studio ad: transcription and analysis | Started automatically when the ad was accepted (D201). 1 MAW-02 warning (licensing), no claim findings |
| 4–5 | Original Nada V1, uploaded through the wizard: transcription and analysis | Needs fixes: COM-01 ×5 (speech 2.8–5.5 s and 8.2–9.9 s, screen at 12 s and 15.1 s, caption), MAW-01, MAW-02 |
| 6 | SALEEM Fix text correction plan (`fix` generate) | Corrected script and caption, «إعلان مدفوع», states that results vary |
| 7–8 | Corrected V2: transcription and analysis | COM-01 caption (see below), AI-01 warning, MAW-02 warning. **No spoken or on-screen claim findings** |

## Files

- `studio-ad-gemini-script.mp4`: 720×1280, about 23.9 s, local Arabic voice (Piper). Frames: `studio-ad-frames.png`.
- `nada-v2-corrected-gemini-plan.mp4`: 768×1344, 15.1 s. The original audio is fully replaced by a local narration of
  Gemini's corrected script. It has a disclosure band and subtitles, the spoken claims are muted, and the on-screen
  claim is covered from 10.5 s to the end. Frames: `nada-v2-frames.png`.

## Defects found by inspection

1. **The on-screen claim leaks at 9.9–10.4 s** (`nada-v2-claim-leak-9.9-10.4s.png`). «النتيجة مضمونة خلال ٣ أيام»
   slides in before the cover starts.
   - Cause: OCR saw the claim at 10 s (partly) and at 11 s, but frame findings were only stored at 12 s and 15.1 s,
     and the cover is the first finding minus 1.5 s.
   - Fix to do: derive cover ranges from the OCR sightings that match the claim, not only from findings.
   - Workaround: set the cover start to 9.5 s in the editor.
2. **Gemini's correction script contains timing markers** («[0.0–2.8] …»). They go into the narration text, so the
   local voice would read them aloud. They were removed by hand for this run.
3. **No mute range for «والنتيجة مضمونة لكل أنواع البشرة» (about 5.5–8.2 s)**, because no finding has those times.
   It is only safe when «replace the original audio» is ticked, which this run did.
4. **The local Arabic voice mispronounces some words.** From Gemini's transcripts: «وتبحثين» was heard as
   «وتلبيثينا», «مخصصة» as «مكثفة», «كريم لمى» as «كريم إلمال», and «جربيه» as «يجب».
5. **MediaRecorder MP4 files have no duration index.** The header says about 3.4 s, playback runs the full length,
   but seeking does not work.
6. **On V2, COM-01 still flags the corrected caption** («للتقليل من مظهر التصبغات… قد تختلف النتائج»). This is a
   deterministic match that is probably over-strict and needs a reviewer. AI-01 appears because Gemini's caption has
   no AI disclosure.
7. **The Studio ad shows only the product name, no image.** No product photo was supplied in this run.
