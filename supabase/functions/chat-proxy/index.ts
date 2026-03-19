import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const genericBaseUrls: Record<string, string> = {
  Google: "https://generativelanguage.googleapis.com/v1beta/openai",
  Mistral: "https://api.mistral.ai/v1",
  Groq: "https://api.groq.com/openai/v1",
  Cohere: "https://api.cohere.ai/v1",
  Perplexity: "https://api.perplexity.ai",
  Together: "https://api.together.xyz/v1",
  Fireworks: "https://api.fireworks.ai/inference/v1",
  OpenRouter: "https://openrouter.ai/api/v1",
  xAI: "https://api.x.ai/v1",
  "AI21 Labs": "https://api.ai21.com/studio/v1",
  Alibaba: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
};

function resolveGenericBaseUrl(providerLabel: string): string {
  return genericBaseUrls[providerLabel] || "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { api_key_id, messages, temperature, max_tokens } = await req.json();

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

    const temp = temperature ?? keyData.temperature;
    const maxTok = max_tokens ?? keyData.max_tokens;
    const systemPrompt = keyData.system_prompt || "You are a helpful assistant.";

    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];

    const start = Date.now();
    let responseText = "";
    let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    if (keyData.provider === "claude") {
      // Claude API format
      const claudeMessages = messages.map((m: any) => ({
        role: m.role === "system" ? "user" : m.role,
        content: m.content,
      }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": keyData.api_key_encrypted,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: keyData.model_name,
          max_tokens: maxTok,
          temperature: temp,
          system: systemPrompt,
          messages: claudeMessages,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${errBody}`);
      }

      const data = await response.json();
      responseText = data.content?.[0]?.text || "";
      usage = {
        prompt_tokens: data.usage?.input_tokens || 0,
        completion_tokens: data.usage?.output_tokens || 0,
        total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      };
    } else {
      // OpenAI-compatible format
      const baseUrl = keyData.provider === "deepseek"
        ? (keyData.base_url || "https://api.deepseek.com")
        : keyData.provider === "generic"
        ? (keyData.base_url || resolveGenericBaseUrl(keyData.provider_label))
        : "https://api.openai.com/v1";

      if (!baseUrl) {
        throw new Error("No base URL configured for this provider. Please edit the key and set a base URL.");
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keyData.api_key_encrypted}`,
        },
        body: JSON.stringify({
          model: keyData.model_name,
          messages: fullMessages,
          temperature: temp,
          max_tokens: maxTok,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`API error: ${response.status} - ${errBody}`);
      }

      const data = await response.json();
      responseText = data.choices?.[0]?.message?.content || "";
      usage = data.usage || usage;
    }

    const latencyMs = Date.now() - start;

    // Record usage
    await supabase.from("usage_history").insert({
      api_key_id,
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
      latency_ms: latencyMs,
      status: "success",
    });

    // Update key stats
    await supabase
      .from("api_keys")
      .update({
        last_used_at: new Date().toISOString(),
        last_latency_ms: latencyMs,
        total_tokens_used: (keyData.total_tokens_used || 0) + usage.total_tokens,
      })
      .eq("id", api_key_id);

    return new Response(
      JSON.stringify({ response: responseText, usage, latency_ms: latencyMs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
