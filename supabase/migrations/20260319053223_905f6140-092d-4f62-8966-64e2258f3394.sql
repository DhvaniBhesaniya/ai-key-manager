
-- Create enum for provider types
CREATE TYPE public.ai_provider AS ENUM ('openai', 'claude', 'deepseek', 'generic');

-- Create enum for key status
CREATE TYPE public.key_status AS ENUM ('valid', 'invalid', 'rate_limited', 'expired', 'unchecked');

-- Create table for API keys
CREATE TABLE public.api_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider public.ai_provider NOT NULL DEFAULT 'openai',
  provider_label TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  model_name TEXT NOT NULL,
  base_url TEXT,
  token_limit INTEGER DEFAULT 4096,
  temperature NUMERIC(3,2) DEFAULT 0.7,
  top_p NUMERIC(3,2) DEFAULT 1.0,
  max_tokens INTEGER DEFAULT 2048,
  system_prompt TEXT DEFAULT 'You are a helpful assistant.',
  status public.key_status NOT NULL DEFAULT 'unchecked',
  last_checked_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  last_latency_ms INTEGER,
  total_tokens_used BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for usage history
CREATE TABLE public.usage_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  latency_ms INTEGER,
  status TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_history ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations (no auth required for this tool)
CREATE POLICY "Allow all access to api_keys" ON public.api_keys FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to usage_history" ON public.usage_history FOR ALL USING (true) WITH CHECK (true);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for usage history lookups
CREATE INDEX idx_usage_history_api_key_id ON public.usage_history(api_key_id);
CREATE INDEX idx_usage_history_created_at ON public.usage_history(created_at DESC);
