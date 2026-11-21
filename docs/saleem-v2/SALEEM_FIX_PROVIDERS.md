# SALEEM Fix — voice and video providers (D198)

SALEEM Fix has three correction methods. This page lists what each one needs and what works today, without any
paid service turned on.

| Method | How it works | Status | Cost |
|---|---|---|---|
| `text_correction` | The `fix` Edge Function asks the configured text model (Gemini) for a corrected caption and script | Works when `GEMINI_API_KEY` is set; counts toward the free-tier quota | Free tier, or the project's Gemini plan |
| `media_edit` | Deterministic edit of the **original** video, rendered in the browser (canvas + Web Audio + MediaRecorder): mute ranges, cover bands over on-screen text, a visible disclosure overlay, subtitles with the corrected script, and an optional corrected voiceover that is recorded or uploaded | **Available.** Verified in Chromium: real MP4, about 15 s long, 768×1344 | None. Nothing is sent to a provider |
| `replacement` (D207) | Opens SALEEM AI Studio with the original ad as the brief: a template-rendered ad (product photos, text, local narration) saved as a new version | **Available** (template rendering). Generated footage or avatars: **not configured** | None for template rendering; generative video is paid |

The full provider matrix, the Gemini audit and the real-provider authorisation plan are in
[AI_STUDIO.md](AI_STUDIO.md).

## Voice providers (`frontend/src/features/fix/providers.ts`)

| Id | Available | What it needs | Notes |
|---|---|---|---|
| `local-piper` (D207) | Yes | Nothing: the open-source Piper voice runs in the browser; the model (~63 MB) downloads once from Hugging Face | Real WAV, replaces the original audio in the corrector. Arabic (male voice only) and English. The text stays on the device. Free |
| `recorded` | Yes | Browser microphone permission (`Permissions-Policy: microphone=(self)` since D207; production previously blocked it) | Local only. Arabic and English |
| `uploaded` | Yes | An audio file the browser can decode (mp3, m4a, wav, webm, ogg) | Local only |
| `gemini_tts` | No | A Gemini API key on a **billed** project, plus server-side `SALEEM_FIX_TTS_PROVIDER=gemini_tts` and an Edge Function adapter (not written) | Gemini's TTS models are not on the free tier. Turning on billing needs the owner's authorisation |
| `heygen` | No | A HeyGen **API** plan and `HEYGEN_API_KEY` as a server secret | The HeyGen website plan and the ChatGPT plugin do not include API access |
| `elevenlabs` | No | An ElevenLabs API account and `ELEVENLABS_API_KEY` as a server secret | Paid beyond a small free character allowance; check the licence before commercial use |

## Video providers

| Id | Available | What it needs |
|---|---|---|
| `veo` | No | Veo via the Gemini API: a billed project (Veo is paid per generated second) |
| `heygen_video` | No | A HeyGen API plan (avatar videos) |
| `runway` | No | A Runway API account and key |

An unavailable provider never returns simulated media. The UI labels it "not configured" and explains what it needs.

## Adding a provider

1. Store the key as a Supabase secret. Never put it in `VITE_*` variables or in the client.
2. Add an adapter to `backend/supabase/functions/fix/` that sends the corrected script (never the original footage
   unless the owner agrees to that provider's privacy terms) and stores the result in the `submissions` bucket under
   the uploader's prefix.
3. Set `available: true` for the provider in `providers.ts` only after a real end-to-end run.
4. Count each generation against `saleem_fix_monthly_limit`. Paid providers should get their own lower cap.

## Privacy and limitations

- `media_edit` runs on the user's device. The signed URL of the original is read with CORS, and the rendered file is
  uploaded as a **new version**. The original file and its findings are never changed.
- Rendering plays the video once, so it takes about as long as the video. If the tab is hidden, the browser may
  throttle rendering. Keep the tab in front while it renders.
- The output is MP4 where the browser records MP4 (Chrome and Edge 125+, Safari). Otherwise it is WebM. Both are
  accepted as uploads.
- Muting is time-based (whole seconds). Lip movement still shows during muted ranges, so a covering voiceover or
  subtitles are recommended.
- A corrected version is analysed again from scratch and never inherits an approval (`finish_accept_correction`).
- An acceptance interrupted during the upload can be claimed again after 10 minutes (`begin_accept_correction`).
