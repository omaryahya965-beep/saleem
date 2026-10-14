-- Blurred evidence thumbnails for the public demo report (landing-page sample). Only the demo is
-- backfilled; older user reports keep no thumbnail (decision D64). Images ship with the app.
insert into public.frames (submission_id, t_seconds, image_path, blurred)
select 'd0000000-0000-0000-0000-000000000003', t, 'demo:/demo/evidence/' || t || '.jpg', true
from (values (12), (17)) v(t)
where not exists (select 1 from public.frames where submission_id = 'd0000000-0000-0000-0000-000000000003' and t_seconds = v.t);

update public.findings f set evidence_frame_id = fr.id
from public.frames fr
where f.run_id = 'a0000000-0000-0000-0000-000000000003' and f.evidence_type = 'frame'
  and fr.submission_id = f.submission_id
  and fr.t_seconds = case when f.rule_code = 'MAW-01' then 17 else 12 end;
