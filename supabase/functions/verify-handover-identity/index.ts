// Edge function: verify a super-admin handover applicant by comparing
// their national-ID photo against their selfie using Lovable AI Gemini vision.
// On match -> sets the handover status to 'approved'. On mismatch -> 'rejected'.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  handover_id: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Caller auth
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is super_admin
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin
      .from("user_roles").select("role")
      .eq("user_id", userRes.user.id).eq("role", "super_admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { handover_id } = (await req.json()) as Body;
    if (!handover_id) {
      return new Response(JSON.stringify({ error: "handover_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: h, error: hErr } = await admin
      .from("super_admin_handovers")
      .select("id, national_id_photo_path, selfie_photo_path, full_name")
      .eq("id", handover_id).maybeSingle();
    if (hErr || !h) {
      return new Response(JSON.stringify({ error: "handover not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!h.national_id_photo_path || !h.selfie_photo_path) {
      return new Response(JSON.stringify({ error: "Both photos required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download both images and convert to base64 data URLs
    const dl = async (path: string) => {
      const { data, error } = await admin.storage.from("handover-ids").download(path);
      if (error || !data) throw new Error(`download failed: ${path}`);
      const buf = new Uint8Array(await data.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
      return `data:${data.type || "image/jpeg"};base64,${btoa(bin)}`;
    };
    const [idImg, selfieImg] = await Promise.all([
      dl(h.national_id_photo_path),
      dl(h.selfie_photo_path),
    ]);

    // Ask Gemini via Lovable AI to compare faces using a tool-call schema
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content:
              "You are an identity-verification assistant. You compare a photo of a national ID document with a selfie photo and decide if they show the same person. Be conservative: only say match if you are confident.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Applicant claims to be: ${h.full_name}. Image 1 = national ID photo. Image 2 = live selfie. Decide if they are the same person.` },
              { type: "image_url", image_url: { url: idImg } },
              { type: "image_url", image_url: { url: selfieImg } },
            ],
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "report_match",
            description: "Report whether the two photos are of the same person",
            parameters: {
              type: "object",
              properties: {
                is_match: { type: "boolean" },
                confidence: { type: "number", description: "0..1 confidence of decision" },
                reasoning: { type: "string" },
              },
              required: ["is_match", "confidence", "reasoning"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "report_match" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "AI rate-limited, try again shortly" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI verification failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI returned no decision" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const decision = JSON.parse(toolCall.function.arguments) as {
      is_match: boolean; confidence: number; reasoning: string;
    };

    const passed = decision.is_match && decision.confidence >= 0.6;
    const newStatus = passed ? "approved" : "rejected";

    const { error: updErr } = await admin.from("super_admin_handovers").update({
      ai_match_score: decision.confidence,
      ai_reasoning: decision.reasoning,
      status: newStatus,
      rejection_reason: passed ? null : `Identity check failed: ${decision.reasoning}`,
    }).eq("id", handover_id);
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      status: newStatus,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("verify-handover-identity error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
