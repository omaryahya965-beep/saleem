-- v2 Phase 4: PDF promotions. Own migration: a new enum value cannot be used in the transaction that adds it.
alter type public.submission_kind add value if not exists 'pdf';
