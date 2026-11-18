-- Rollback of 20261117040100_v2_comments_pdf.sql. Data loss: comments.
drop trigger if exists review_decisions_note on public.review_decisions;
drop function if exists public.comments_decision_note();
drop trigger if exists submissions_v2_carry_comments on public.submissions;
drop function if exists public.comments_carry_change_requests();
drop function if exists public.add_comment(uuid, uuid, text, jsonb, uuid, text, uuid[]);
drop function if exists public.edit_comment(uuid, text);
drop function if exists public.resolve_comment(uuid, boolean);
drop function if exists public.delete_comment(uuid);
drop function if exists public.valid_anchor(jsonb);
drop table if exists public.comments;
alter table public.frames drop column if exists page_no, drop column if exists text_source;
update storage.buckets
set allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp', 'audio/wav', 'audio/x-wav', 'audio/webm']
where id = 'media';
