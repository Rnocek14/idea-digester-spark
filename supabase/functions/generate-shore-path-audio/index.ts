// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SARAH_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";
const BUCKET = "shore-path-audio";

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function ensureBucket(sb: ReturnType<typeof admin>) {
  const { data } = await sb.storage.getBucket(BUCKET);
  if (!data) {
    await sb.storage.createBucket(BUCKET, { public: true });
  }
}

type VoiceSettings = {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
  speed?: number;
};

async function synthesize(text: string, voiceId: string, settings?: VoiceSettings): Promise<ArrayBuffer> {
  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) throw new Error("ElevenLabs not connected");
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: settings?.stability ?? 0.55,
          similarity_boost: settings?.similarity_boost ?? 0.8,
          style: settings?.style ?? 0.35,
          use_speaker_boost: settings?.use_speaker_boost ?? true,
          speed: settings?.speed ?? 0.98,
        },
      }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  return await res.arrayBuffer();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const stopId: string | undefined = body.stop_id;
    const orderIndex: number | undefined = body.order_index;
    const voiceId: string = body.voice_id || SARAH_VOICE_ID;
    const force: boolean = !!body.force;
    const settings: VoiceSettings | undefined = body.voice_settings;
    const previewLabel: string | undefined = body.preview_label; // if set, save to preview path and skip DB update

    if (!stopId && !orderIndex) {
      return new Response(
        JSON.stringify({ error: "Provide stop_id or order_index" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sb = admin();
    await ensureBucket(sb);

    const q = sb.from("shore_path_stops").select("*").limit(1);
    const { data: stop, error: selErr } = stopId
      ? await q.eq("id", stopId).single()
      : await q.eq("order_index", orderIndex!).single();
    if (selErr || !stop) throw new Error(`Stop not found: ${selErr?.message}`);

    if (stop.audio_url && !force) {
      return new Response(
        JSON.stringify({ ok: true, skipped: true, audio_url: stop.audio_url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const transcript: string = (stop.story_long || stop.description || "").trim();
    if (!transcript) throw new Error("Stop has no story_long or description to narrate");

    const mp3 = await synthesize(transcript, voiceId, settings);
    const path = previewLabel
      ? `stops/previews/${stop.order_index}-${stop.id}-${previewLabel}.mp3`
      : `stops/${stop.order_index}-${stop.id}.mp3`;
    const { error: upErr } = await sb.storage
      .from(BUCKET)
      .upload(path, mp3, { contentType: "audio/mpeg", upsert: true });
    if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
    // rough duration estimate: 145 wpm
    const words = transcript.split(/\s+/).length;
    const duration = Math.round((words / 145) * 60);

    if (!previewLabel) {
      const { error: updErr } = await sb
        .from("shore_path_stops")
        .update({
          audio_url: pub.publicUrl,
          audio_duration_sec: duration,
          audio_transcript: transcript,
          audio_voice_id: voiceId,
        })
        .eq("id", stop.id);
      if (updErr) throw new Error(`DB update failed: ${updErr.message}`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        stop: { id: stop.id, name: stop.name, order_index: stop.order_index },
        audio_url: pub.publicUrl,
        duration_sec: duration,
        words,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});