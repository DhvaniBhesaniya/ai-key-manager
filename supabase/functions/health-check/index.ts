import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getProviderConfig(provider: string, baseUrl: string | null) {
  switch (provider) {
    case "openai":
      return { url: "https://api.openai.com/v1/chat/completions", headerKey: "Authorization", headerPrefix: "Bearer " };
    case "claude":
      return { url: "https://api.anthropic.com/v1/messages", headerKey: "x-api-key", headerPrefix: "" };
    case "deepseek":
      return { url: baseUrl ? `${baseUrl}/chat/completions` : "https://api.deepseek.com/chat/completions", headerKey: "Authorization", headerPrefix: "Bearer " };
    case "generic":
      return { url: baseUrl ? `${baseUrl}/chat/completions` : "", headerKey: "Authorization", headerPrefix: "Bearer " };
    default:
      return { url: baseUrl || "", headerKey: "Authorization", headerPrefix: "Bearer " };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { api_key_id } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: keyData, error } = await supabase
      .from("api_keys")
      .select("*")
      .eq("id", api_key_id)
      .single();

    if (error || !keyData) {
      return new Response(JSON.stringify({ error: "Key not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = getProviderConfig(keyData.provider, keyData.base_url);
    const start = Date.now();
    let status = "valid";
    let latencyMs = 0;

    try {
      let response: Response;

      if (keyData.provider === "claude") {
        response = await fetch(config.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": keyData.api_key_encrypted,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: keyData.model_name,
            max_tokens: 5,
            messages: [{ role: "user", content: "Hi" }],
          }),
        });
      } else {
        response = await fetch(config.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [config.headerKey]: `${config.headerPrefix}${keyData.api_key_encrypted}`,
          },
          body: JSON.stringify({
            model: keyData.model_name,
            messages: [{ role: "user", content: "Hi" }],
            max_tokens: 5,
          }),
        });
      }

      latencyMs = Date.now() - start;

      if (response.status === 401 || response.status === 403) {
        status = "invalid";
      } else if (response.status === 429) {
        status = "rate_limited";
      } else if (!response.ok) {
        const body = await response.text();
        if (body.toLowerCase().includes("expired")) {
          status = "expired";
        } else {
          status = "invalid";
        }
      }
    } catch (fetchErr) {
      latencyMs = Date.now() - start;
      status = "invalid";
    }

    await supabase
      .from("api_keys")
      .update({
        status,
        last_checked_at: new Date().toISOString(),
        last_latency_ms: latencyMs,
      })
      .eq("id", api_key_id);

    return new Response(JSON.stringify({ status, latency_ms: latencyMs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
