import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { fetchApiKeys, sendChatMessage, type ApiKey } from "@/lib/api";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  tokens?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  latency_ms?: number;
}

export default function ChatPage() {
  const { data: keys = [] } = useQuery({
    queryKey: ["api-keys"],
    queryFn: fetchApiKeys,
  });

  const [selectedKeyId, setSelectedKeyId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const selectedKey = keys.find((k) => k.id === selectedKeyId);

  useEffect(() => {
    if (keys.length > 0 && !selectedKeyId) {
      setSelectedKeyId(keys[0].id);
      setTemperature(keys[0].temperature);
      setMaxTokens(keys[0].max_tokens);
    }
  }, [keys, selectedKeyId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || !selectedKeyId) return;

    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const result = await sendChatMessage(selectedKeyId, apiMessages, {
        temperature,
        max_tokens: maxTokens,
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.response,
          tokens: result.usage,
          latency_ms: result.latency_ms,
        },
      ]);
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="flex gap-6 h-[calc(100vh-8rem)]">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {selectedKey ? `${selectedKey.provider_label} — ${selectedKey.model_name}` : "Select a key"}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {messages.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">Select a key and start chatting</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[70%] rounded-lg px-3.5 py-2.5 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.tokens && (
                    <p className="text-[10px] mt-2 opacity-60 font-mono">
                      {msg.tokens.total_tokens} tokens • {msg.latency_ms}ms
                    </p>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-md bg-foreground/10 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-foreground" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-muted rounded-lg px-3.5 py-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSend} className="p-3 border-t border-border flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 text-sm"
              disabled={loading || !selectedKeyId}
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim() || !selectedKeyId}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>

        {/* Config Panel */}
        <div className="w-64 bg-card border border-border rounded-lg p-4 space-y-5 shrink-0">
          <div>
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Configuration</h3>
            <div>
              <Label className="text-xs">API Key</Label>
              <Select value={selectedKeyId} onValueChange={(v) => {
                setSelectedKeyId(v);
                const k = keys.find((k) => k.id === v);
                if (k) {
                  setTemperature(k.temperature);
                  setMaxTokens(k.max_tokens);
                }
              }}>
                <SelectTrigger className="mt-1 text-xs"><SelectValue placeholder="Select key" /></SelectTrigger>
                <SelectContent>
                  {keys.map((k) => (
                    <SelectItem key={k.id} value={k.id} className="text-xs">
                      {k.provider_label} — {k.model_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Temperature: {temperature}</Label>
            <Slider
              className="mt-2"
              min={0}
              max={2}
              step={0.1}
              value={[temperature]}
              onValueChange={(v) => setTemperature(v[0])}
            />
          </div>

          <div>
            <Label className="text-xs">Max Tokens</Label>
            <Input
              type="number"
              className="mt-1 text-xs"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value) || 0)}
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              setMessages([]);
              toast.success("Chat cleared");
            }}
          >
            Clear Chat
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
