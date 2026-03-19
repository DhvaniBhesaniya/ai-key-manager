import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchApiKeys, sendRawRequest } from "@/lib/api";
import { Play, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function PlaygroundPage() {
  const { data: keys = [] } = useQuery({
    queryKey: ["api-keys"],
    queryFn: fetchApiKeys,
  });

  const [selectedKeyId, setSelectedKeyId] = useState<string>("");
  const [requestBody, setRequestBody] = useState(
    JSON.stringify(
      {
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Hello!" },
        ],
        temperature: 0.7,
        max_tokens: 100,
      },
      null,
      2
    )
  );
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  async function handleSend() {
    if (!selectedKeyId) {
      toast.error("Select an API key");
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(requestBody);
    } catch {
      toast.error("Invalid JSON");
      return;
    }

    setLoading(true);
    setResponse("");
    setLatency(null);

    try {
      const result = await sendRawRequest(selectedKeyId, parsed);
      setResponse(JSON.stringify(result.response, null, 2));
      setLatency(result.latency_ms);
    } catch (err: any) {
      setResponse(JSON.stringify({ error: err.message }, null, 2));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">API Playground</h1>
            <p className="text-sm text-muted-foreground mt-1">Send raw requests to test your API keys</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
              <SelectTrigger className="w-64 text-xs">
                <SelectValue placeholder="Select API key" />
              </SelectTrigger>
              <SelectContent>
                {keys.map((k) => (
                  <SelectItem key={k.id} value={k.id} className="text-xs">
                    {k.provider_label} — {k.model_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={handleSend} disabled={loading}>
              {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
              Send
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 h-[calc(100vh-12rem)]">
          {/* Request */}
          <div className="bg-card border border-border rounded-lg flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Request Body</Label>
            </div>
            <textarea
              className="flex-1 p-4 bg-transparent font-mono text-xs text-foreground resize-none focus:outline-none scrollbar-thin"
              value={requestBody}
              onChange={(e) => setRequestBody(e.target.value)}
              spellCheck={false}
            />
          </div>

          {/* Response */}
          <div className="bg-card border border-border rounded-lg flex flex-col overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Response</Label>
              {latency !== null && (
                <span className="text-xs font-mono text-success">{latency}ms</span>
              )}
            </div>
            <pre className="flex-1 p-4 font-mono text-xs text-foreground overflow-auto scrollbar-thin whitespace-pre-wrap">
              {loading ? "Sending request..." : response || "Response will appear here"}
            </pre>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
