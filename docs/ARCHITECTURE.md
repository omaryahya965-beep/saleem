# سَليم | SALEEM — Architecture & Technical Specifications

> Compliance checker for Saudi digital creators.  
> Pre-publish evaluation of video, image, and text content against Saudi advertising and media regulations.

---

## 1. System Architecture Overview

```text
+-----------------------------------------------------------------------------------+
|                                  CLIENT LAYER                                     |
|                                                                                   |
|  React 19 + TypeScript (Vite, TanStack Router/Query, Tailwind CSS)                |
|  - screens: Landing, Login, Dashboard, NewCheck, Processing, Report, Ready, Rules |
|  - client-side SHA-256 calculation & video frame preview extraction               |
+-------------------------+-----------------------------------+---------------------+
                          |                                   |
                          | Direct Storage Upload & Auth      | Direct REST & Realtime
                          v                                   v
+-----------------------------------------------------------------------------------+
|                              SUPABASE BACKEND LAYER                               |
|                                                                                   |
|  +-----------------------+  +------------------------+  +----------------------+  |
|  |     Supabase Auth     |  |   PostgreSQL 17 (DB)   |  |   Supabase Storage   |  |
|  | - JWT session tokens  |  | - RLS user isolation   |  | - Bucket: 'media'    |  |
|  | - Demo credentials    |  | - submissions, findings|  | - Private signed URLs|  |
|  |                       |  |   rules, certificates  |  | - 24-hr lifecycle    |  |
|  +-----------------------+  +------------------------+  +----------------------+  |
|                                         |                                         |
|                                         | Triggers / Invocations                  |
|                                         v                                         |
|  +-----------------------------------------------------------------------------+  |
|  |                   Supabase Edge Functions (Deno Runtime)                    |  |
|  |                                                                             |  |
|  |   1. analyze: End-to-end multi-modal compliance pipeline                    |  |
|  |   2. cleanup-media: Scheduled & on-demand 24h media deletion worker         |  |
|  +-------------------------------------+---------------------------------------+  |
+----------------------------------------|------------------------------------------+
                                         |
                                         | External API Calls (Secure server-side)
                                         v
+-----------------------------------------------------------------------------------+
|                               AI PROVIDERS LAYER                                  |
|                                                                                   |
|  +----------------------------------+     +-----------------------------------+   |
|  |     OpenAI (Whisper ASR)         |     |    Anthropic (Claude 3.5 Sonnet)  |   |
|  | - Audio speech-to-text           |     | - Multi-modal frame reasoning     |   |
|  | - Word & segment timestamps      |     | - Legal nuance & context auditor  |   |
|  +----------------------------------+     +-----------------------------------+   |
|                                                                                   |
|  * Built-in Demo Engine: Instant zero-config offline mode for local testing      |
+-----------------------------------------------------------------------------------+
```

---

## 2. Data Model Summary (PostgreSQL Schema)

The database schema is defined in `backend/supabase/migrations/20261013000000_saleem_schema.sql` with full Row-Level Security (RLS) enabled on all tables:

### 2.1 Core Tables

| Table | Purpose | Primary Keys / Foreign Keys | RLS Policies |
| :--- | :--- | :--- | :--- |
| `rules` | Catalog of Saudi advertising and media regulations (GCAM, Mawthooq, Commerce, SFDA). | `id` (text, e.g. `MAW-01`) | Public read access for all authenticated and anonymous users. |
| `submissions` | Uploaded creator media, metadata, SHA-256 hash, analysis status, and deletion flags. | `id` (uuid) PK, `user_id` FK -> `auth.users`, `parent_id` self FK | Creators can only read and write their own submissions (`auth.uid() = user_id`). |
| `findings` | Individual violations or warnings discovered during analysis with timestamps and fixes. | `id` (uuid) PK, `submission_id` FK -> `submissions.id`, `rule_id` FK -> `rules.id` | Creators can only view findings belonging to their own submissions. |
| `compliance_logs` | Verifiable audit log and certificate metadata for printable reports. | `id` (uuid) PK, `submission_id` FK -> `submissions.id` | Creators can only view certificates for their own submissions. |

### 2.2 Entity Relationship Diagram

```text
[auth.users]
     | (1:N)
     v
[submissions] <----------+ (self: re-check versioning)
     | (1:N)             | parent_id
     +------------+      |
     |            |      |
     v            v      |
[findings]  [compliance_logs]
     |
     v (N:1)
  [rules]
```

---

## 3. Analysis Pipeline Execution Steps

When a creator clicks **"ابدأ الفحص" (Start Check)**, the system executes an automated 5-stage pipeline:

```text
[1. Upload & Hash] ---> [2. Transcription] ---> [3. Deterministic Rules]
                                                        |
                                                        v
[5. Report Store] <--- [4. Merge & Calibration] <--- [3b. LLM Reasoning]
```

1. **Step 1 — Download & Validation**:
   - The edge function verifies the submission record and retrieves the uploaded media file from the private `media` bucket using a short-lived signed URL.
2. **Step 2 — Arabic ASR Transcription**:
   - Audio is extracted and processed via OpenAI Whisper (`whisper-1`).
   - Generates Arabic speech transcript broken down into time-coded segments (e.g., `00:00 - 00:05`, `00:06 - 00:12`).
3. **Step 3a — Deterministic Evaluation (Regex & Keyword Matcher)**:
   - Evaluates content against mandatory keyword rules:
     - Mawthooq license disclosure (`#إعلان`, `ترخيص موثوق`, `إعلان مدفوع`).
     - SFDA medical disclaimer checks.
     - Financial advice warnings.
     - Children & minor presence tags.
4. **Step 3b — Multi-Modal LLM Reasoning**:
   - Frames and transcript context are evaluated by Anthropic Claude 3.5 Sonnet.
   - Audits visual disclaimers, sponsor logo prominence, misleading claims, and regulatory edge cases.
5. **Step 4 — Merge & Calibration**:
   - Combines findings from deterministic and LLM engines.
   - Deduplicates overlapping rule triggers on the same timestamp.
   - Calibrates severity levels (`violation`, `warning`, `info`) and calculates the overall compliance status (`ready`, `needs_review`, `needs_fix`).
6. **Step 5 — Persistence & Notification**:
   - Writes findings to `findings` table.
   - Updates `submissions.status = 'completed'` and `submissions.progress = 100`.
   - Realtime listener notifies the frontend to transition from the Processing view to the Report view.

---

## 4. Prompts & Regulatory Rules Organization

| Component | File Location | Description |
| :--- | :--- | :--- |
| **Rulebook Catalog** | `backend/supabase/seed.sql` | 12 seed rules with codes, legal source links, titles, descriptions in Arabic, and default severities. |
| **Deterministic Engine** | `backend/supabase/functions/_shared/rules/deterministic.ts` | Fast, offline TypeScript rule matcher using regular expressions and keyword checks. |
| **LLM Auditor Prompt** | `backend/supabase/functions/_shared/providers/llm.ts` | Comprehensive system prompt instructing Claude to audit Saudi media compliance with structured JSON schema output. |
| **ASR Provider** | `backend/supabase/functions/_shared/providers/transcription.ts` | Arabic speech-to-text adapter with Whisper and fallback demo transcripts. |
| **Pipeline Types** | `backend/supabase/functions/_shared/types.ts` | Shared type definitions across Edge Functions. |
| **Media Retention Worker**| `backend/supabase/functions/cleanup-media/index.ts` | Enforces 24-hour privacy retention policy by purging media files from storage. |
| **Frontend API Layer** | `frontend/src/lib/api/` | Type-safe Supabase query client, subscriptions, and demo-fallback services. |

---

## 5. Security & Privacy Model

1. **Row-Level Security (RLS)**:
   - Every database table strictly isolates data by user JWT (`auth.uid()`). No creator can view or query another creator's submissions.
2. **Short-Lived Signed URLs**:
   - The storage bucket `media` is fully private. Media is never served via public URLs; only temporary signed URLs with 15-minute expirations are generated.
3. **24-Hour Auto-Deletion**:
   - Uploaded media files are automatically deleted after 24 hours to protect creator intellectual property. Findings, certificates, and cryptographic hashes are permanently retained for compliance logs.
4. **Zero-Trace Demo Mode**:
   - When external API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) are not provided, the system falls back to realistic deterministic demo mocks without leaking network calls.
