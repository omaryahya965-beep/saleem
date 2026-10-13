// supabase/functions/cleanup-media/index.ts
// Deletes media 24 hours after analysis or on user demand, preserving findings, transcripts, and hashes.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "http://127.0.0.1:54321";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const explicitSubmissionId = body.submission_id;

    let targetSubmissions: { id: string; user_id?: string; file_path?: string }[] = [];

    if (explicitSubmissionId) {
      // User-requested single submission media deletion
      const { data, error } = await supabase
        .from("submissions")
        .select("id, user_id, file_path")
        .eq("id", explicitSubmissionId)
        .is("media_deleted_at", null)
        .maybeSingle();

      if (error) throw error;
      if (data) targetSubmissions = [data];
    } else {
      // Scheduled 24-hour cleanup
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("submissions")
        .select("id, user_id, file_path")
        .lt("analyzed_at", twentyFourHoursAgo)
        .is("media_deleted_at", null)
        .limit(50);

      if (error) throw error;
      targetSubmissions = data || [];
    }

    console.log(
      `[CleanupMedia] Processing ${targetSubmissions.length} submissions for media deletion.`,
    );

    let filesRemovedCount = 0;

    for (const sub of targetSubmissions) {
      const folderPath = sub.user_id ? `${sub.user_id}/${sub.id}` : sub.id;

      // List files inside submission folder
      const { data: fileList } = await supabase.storage.from("media").list(folderPath);

      if (fileList && fileList.length > 0) {
        const pathsToRemove = fileList.map((f) => `${folderPath}/${f.name}`);
        const { data: removed } = await supabase.storage.from("media").remove(pathsToRemove);
        filesRemovedCount += removed?.length || 0;
      }

      // Mark media as deleted in database, preserving findings and hash
      await supabase
        .from("submissions")
        .update({
          media_deleted_at: new Date().toISOString(),
          file_path: null,
          audio_path: null,
          thumbnail_path: null,
        })
        .eq("id", sub.id);

      await supabase.from("frames").update({ image_path: null }).eq("submission_id", sub.id);
    }

    return new Response(
      JSON.stringify({
        cleaned_submissions_count: targetSubmissions.length,
        files_removed_count: filesRemovedCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[CleanupMedia] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
