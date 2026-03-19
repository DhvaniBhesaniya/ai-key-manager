import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { StatCard } from "@/components/StatCard";
import { StatusDot } from "@/components/StatusDot";
import { fetchApiKeys, fetchUsageHistory, type ApiKey } from "@/lib/api";
import { Key, CheckCircle, Activity, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function DashboardPage() {
  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: fetchApiKeys,
  });

  const { data: usage = [] } = useQuery({
    queryKey: ["usage-history"],
    queryFn: () => fetchUsageHistory(),
  });

  const totalKeys = keys.length;
  const validKeys = keys.filter((k) => k.status === "valid").length;
  const invalidKeys = keys.filter((k) => k.status === "invalid" || k.status === "expired").length;
  const totalTokens = keys.reduce((sum, k) => sum + (k.total_tokens_used || 0), 0);

  const providerCounts = keys.reduce((acc, k) => {
    acc[k.provider_label] = (acc[k.provider_label] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const recentActivity = usage.slice(0, 10);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Overview of your AI API keys and usage</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Keys"
            value={totalKeys}
            subtitle={`${Object.keys(providerCounts).length} providers`}
            icon={<Key className="w-4 h-4" />}
          />
          <StatCard
            title="Health Ratio"
            value={totalKeys > 0 ? `${Math.round((validKeys / totalKeys) * 100)}%` : "—"}
            subtitle={`${validKeys} valid, ${invalidKeys} invalid`}
            icon={<CheckCircle className="w-4 h-4" />}
          />
          <StatCard
            title="24h Usage"
            value={usage.filter((u) => {
              const d = new Date(u.created_at);
              return Date.now() - d.getTime() < 86400000;
            }).length}
            subtitle="requests"
            icon={<Activity className="w-4 h-4" />}
          />
          <StatCard
            title="Total Tokens"
            value={totalTokens.toLocaleString()}
            subtitle="across all keys"
            icon={<Clock className="w-4 h-4" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Provider Distribution */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold text-card-foreground mb-4">Provider Distribution</h2>
            {Object.keys(providerCounts).length === 0 ? (
              <p className="text-sm text-muted-foreground">No keys added yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(providerCounts).map(([provider, count]) => (
                  <div key={provider} className="flex items-center justify-between">
                    <span className="text-sm text-foreground font-medium">{provider}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-300"
                          style={{ width: `${(count / totalKeys) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold text-card-foreground mb-4">Recent Activity</h2>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet</p>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((record) => (
                  <div key={record.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${record.status === "success" ? "bg-success" : "bg-destructive"}`} />
                      <span className="text-xs font-mono text-foreground">
                        {record.total_tokens} tokens
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {record.latency_ms && (
                        <span className="text-xs font-mono text-muted-foreground">
                          {record.latency_ms}ms
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(record.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Keys List */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-card-foreground mb-4">All API Keys</h2>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No keys added yet. Go to Key Management to add your first key.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Provider</th>
                    <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Model</th>
                    <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left py-2 pr-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">Latency</th>
                    <th className="text-left py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Used</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((key) => (
                    <tr key={key.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 pr-4 font-medium text-foreground">{key.provider_label}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">{key.model_name}</td>
                      <td className="py-2.5 pr-4"><StatusDot status={key.status} /></td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-muted-foreground">
                        {key.last_latency_ms ? `${key.last_latency_ms}ms` : "—"}
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">
                        {key.last_used_at
                          ? formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })
                          : "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
