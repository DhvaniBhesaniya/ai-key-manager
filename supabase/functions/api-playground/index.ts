import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { api_key_id, request_body } = await req.json();

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

    // Add model if not in request
    const body = { model: keyData.model_name, ...request_body };

    let url: string;
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (keyData.provider === "claude") {
      url = "https://api.anthropic.com/v1/messages";
      headers["x-api-key"] = keyData.api_key_encrypted;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      const baseUrl = keyData.provider === "deepseek"
        ? (keyData.base_url || "https://api.deepseek.com")
        : keyData.provider === "generic"
        ? keyData.base_url
        : "https://api.openai.com/v1";
      url = `${baseUrl}/chat/completions`;
      headers["Authorization"] = `Bearer ${keyData.api_key_encrypted}`;
    }

    const start = Date.now();
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const latencyMs = Date.now() - start;
    const data = await response.json();

    // Record usage
    const totalTokens = data.usage?.total_tokens || data.usage?.input_tokens
      ? (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
      : 0;

    if (totalTokens > 0) {
      await supabase.from("usage_history").insert({
        api_key_id,
        prompt_tokens: data.usage?.prompt_tokens || data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.completion_tokens || data.usage?.output_tokens || 0,
        total_tokens: totalTokens,
        latency_ms: latencyMs,
        status: response.ok ? "success" : "error",
      });
    }

    return new Response(
      JSON.stringify({ response: data, latency_ms: latencyMs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
