import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { StatusDot } from "@/components/StatusDot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { fetchApiKeys, createApiKey, updateApiKey, deleteApiKey, healthCheckKey, maskApiKey, type ApiKey } from "@/lib/api";
import { Plus, Trash2, Pencil, RefreshCw, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const defaultForm = {
  provider: "openai" as ApiKey["provider"],
  provider_label: "OpenAI",
  api_key_encrypted: "",
  model_name: "gpt-4o-mini",
  base_url: "",
  token_limit: 4096,
  temperature: 0.7,
  top_p: 1.0,
  max_tokens: 2048,
  system_prompt: "You are a helpful assistant.",
};

const providerPresets: Record<string, { provider: ApiKey["provider"]; model: string; base_url: string }> = {
  OpenAI: { provider: "openai", model: "gpt-4o-mini", base_url: "" },
  Claude: { provider: "claude", model: "claude-3-5-sonnet-20241022", base_url: "" },
  DeepSeek: { provider: "deepseek", model: "deepseek-chat", base_url: "https://api.deepseek.com" },
  "Custom (OpenAI-compatible)": { provider: "generic", model: "", base_url: "" },
};

export default function KeyManagementPage() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null);
  const [form, setForm] = useState(defaultForm);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: fetchApiKeys,
  });

  const createMutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setSheetOpen(false);
      resetForm();
      toast.success("API key added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ApiKey> }) => updateApiKey(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      setSheetOpen(false);
      setEditingKey(null);
      resetForm();
      toast.success("API key updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const healthMutation = useMutation({
    mutationFn: healthCheckKey,
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success(`Key is ${data.status} (${data.latency_ms}ms)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function resetForm() {
    setForm(defaultForm);
    setEditingKey(null);
  }

  function openEdit(key: ApiKey) {
    setEditingKey(key);
    setForm({
      provider: key.provider,
      provider_label: key.provider_label,
      api_key_encrypted: "",
      model_name: key.model_name,
      base_url: key.base_url || "",
      token_limit: key.token_limit,
      temperature: key.temperature,
      top_p: key.top_p,
      max_tokens: key.max_tokens,
      system_prompt: key.system_prompt,
    });
    setSheetOpen(true);
  }

  function handleProviderChange(label: string) {
    const preset = providerPresets[label];
    if (preset) {
      setForm((f) => ({
        ...f,
        provider_label: label,
        provider: preset.provider,
        model_name: preset.model || f.model_name,
        base_url: preset.base_url,
      }));
    } else {
      setForm((f) => ({ ...f, provider_label: label }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.api_key_encrypted && !editingKey) {
      toast.error("API key is required");
      return;
    }
    if (editingKey) {
      const updates: Partial<ApiKey> = {
        provider: form.provider,
        provider_label: form.provider_label,
        model_name: form.model_name,
        base_url: form.base_url || null,
        token_limit: form.token_limit,
        temperature: form.temperature,
        top_p: form.top_p,
        max_tokens: form.max_tokens,
        system_prompt: form.system_prompt,
      };
      if (form.api_key_encrypted) {
        updates.api_key_encrypted = form.api_key_encrypted;
      }
      updateMutation.mutate({ id: editingKey.id, updates });
    } else {
      createMutation.mutate({
        ...form,
        base_url: form.base_url || null,
      });
    }
  }

  function exportKeys() {
    const exportData = keys.map((k) => ({
      provider: k.provider,
      provider_label: k.provider_label,
      model_name: k.model_name,
      base_url: k.base_url,
      token_limit: k.token_limit,
      temperature: k.temperature,
      top_p: k.top_p,
      max_tokens: k.max_tokens,
      system_prompt: k.system_prompt,
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "api-keys-export.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Keys exported (without secrets)");
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Key Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Add, edit, and test your AI API keys</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportKeys}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export
            </Button>
            <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) resetForm(); }}>
              <SheetTrigger asChild>
                <Button size="sm">
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Add Key
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{editingKey ? "Edit API Key" : "Add API Key"}</SheetTitle>
                </SheetHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                  <div>
                    <Label className="text-xs">Provider</Label>
                    <Select value={form.provider_label} onValueChange={handleProviderChange}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.keys(providerPresets).map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">API Key</Label>
                    <Input
                      type="password"
                      className="mt-1 font-mono text-xs"
                      placeholder={editingKey ? "Leave blank to keep current" : "sk-..."}
                      value={form.api_key_encrypted}
                      onChange={(e) => setForm((f) => ({ ...f, api_key_encrypted: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Model Name</Label>
                    <Input
                      className="mt-1 font-mono text-xs"
                      value={form.model_name}
                      onChange={(e) => setForm((f) => ({ ...f, model_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Base URL (optional)</Label>
                    <Input
                      className="mt-1 font-mono text-xs"
                      placeholder="https://api.example.com/v1"
                      value={form.base_url}
                      onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Temperature</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        className="mt-1"
                        value={form.temperature}
                        onChange={(e) => setForm((f) => ({ ...f, temperature: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Max Tokens</Label>
                      <Input
                        type="number"
                        className="mt-1"
                        value={form.max_tokens}
                        onChange={(e) => setForm((f) => ({ ...f, max_tokens: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Top P</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        className="mt-1"
                        value={form.top_p}
                        onChange={(e) => setForm((f) => ({ ...f, top_p: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Token Limit</Label>
                      <Input
                        type="number"
                        className="mt-1"
                        value={form.token_limit}
                        onChange={(e) => setForm((f) => ({ ...f, token_limit: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">System Prompt</Label>
                    <Textarea
                      className="mt-1 text-xs"
                      rows={3}
                      value={form.system_prompt}
                      onChange={(e) => setForm((f) => ({ ...f, system_prompt: e.target.value }))}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingKey ? "Update Key" : "Add Key"}
                  </Button>
                </form>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Keys Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading keys...</div>
          ) : keys.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No API keys yet. Click "Add Key" to get started.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Provider</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Model</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Key</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Checked</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors duration-150">
                    <td className="px-4 py-3 font-medium text-foreground">{key.provider_label}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{key.model_name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{maskApiKey(key.api_key_encrypted)}</td>
                    <td className="px-4 py-3"><StatusDot status={key.status} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {key.last_checked_at
                        ? formatDistanceToNow(new Date(key.last_checked_at), { addSuffix: true })
                        : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => healthMutation.mutate(key.id)}
                          disabled={healthMutation.isPending}
                          title="Test Key"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${healthMutation.isPending ? "animate-spin" : ""}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(key)}
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm("Delete this API key?")) deleteMutation.mutate(key.id);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
