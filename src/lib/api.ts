import { supabase } from "@/integrations/supabase/client";

export interface ApiKey {
  id: string;
  provider: "openai" | "claude" | "deepseek" | "generic";
  provider_label: string;
  api_key_encrypted: string;
  model_name: string;
  base_url: string | null;
  token_limit: number;
  temperature: number;
  top_p: number;
  max_tokens: number;
  system_prompt: string;
  status: "valid" | "invalid" | "rate_limited" | "expired" | "unchecked";
  last_checked_at: string | null;
  last_used_at: string | null;
  last_latency_ms: number | null;
  total_tokens_used: number;
  created_at: string;
  updated_at: string;
}

export interface UsageRecord {
  id: string;
  api_key_id: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latency_ms: number | null;
  status: string | null;
  error_message: string | null;
  created_at: string;
}

export async function fetchApiKeys(): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as ApiKey[];
}

export async function createApiKey(key: Omit<ApiKey, "id" | "status" | "last_checked_at" | "last_used_at" | "last_latency_ms" | "total_tokens_used" | "created_at" | "updated_at">): Promise<ApiKey> {
  const { data, error } = await supabase
    .from("api_keys")
    .insert(key)
    .select()
    .single();
  if (error) throw error;
  return data as ApiKey;
}

export async function updateApiKey(id: string, updates: Partial<ApiKey>): Promise<ApiKey> {
  const { data, error } = await supabase
    .from("api_keys")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ApiKey;
}

export async function deleteApiKey(id: string): Promise<void> {
  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function fetchUsageHistory(apiKeyId?: string): Promise<UsageRecord[]> {
  let query = supabase
    .from("usage_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (apiKeyId) {
    query = query.eq("api_key_id", apiKeyId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as UsageRecord[];
}

export async function healthCheckKey(id: string): Promise<{ status: string; latency_ms: number }> {
  const response = await supabase.functions.invoke("health-check", {
    body: { api_key_id: id },
  });
  if (response.error) throw response.error;
  return response.data;
}

export async function sendChatMessage(
  apiKeyId: string,
  messages: { role: string; content: string }[],
  config?: { temperature?: number; max_tokens?: number; stream?: boolean }
): Promise<{ response: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }; latency_ms: number }> {
  const response = await supabase.functions.invoke("chat-proxy", {
    body: { api_key_id: apiKeyId, messages, ...config },
  });
  if (response.error) throw response.error;
  return response.data;
}

export async function sendRawRequest(
  apiKeyId: string,
  requestBody: Record<string, unknown>
): Promise<{ response: unknown; latency_ms: number }> {
  const response = await supabase.functions.invoke("api-playground", {
    body: { api_key_id: apiKeyId, request_body: requestBody },
  });
  if (response.error) throw response.error;
  return response.data;
}

export function maskApiKey(key: string): string {
  if (key.length <= 8) return "••••••••";
  return key.substring(0, 4) + "••••••••" + key.substring(key.length - 4);
}
