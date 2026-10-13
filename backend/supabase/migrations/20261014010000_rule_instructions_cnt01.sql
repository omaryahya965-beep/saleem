-- CNT-01: speech that clearly indicates a child is being filmed is also evidence (not only frames).
-- Found by the evaluation harness (kid-daily-vlog case missed in text mode).
update public.rules
set llm_instructions = 'In frames, look for a person who appears to be a minor; in speech, look for the creator presenting or addressing a child on camera (e.g. naming a child and their age in daily-life content). Describe neutrally ("a person who appears to be a child"). Never identify anyone. If unsure, warning with confidence <= 0.6.'
where code = 'CNT-01';
