import { cn } from "@/lib/utils";

interface StatusDotProps {
  status: "valid" | "invalid" | "rate_limited" | "expired" | "unchecked";
  className?: string;
  showLabel?: boolean;
}

const statusConfig = {
  valid: { color: "bg-success", label: "Valid" },
  invalid: { color: "bg-destructive", label: "Invalid" },
  rate_limited: { color: "bg-warning", label: "Rate Limited" },
  expired: { color: "bg-destructive", label: "Expired" },
  unchecked: { color: "bg-muted-foreground", label: "Unchecked" },
};

export function StatusDot({ status, className, showLabel = true }: StatusDotProps) {
  const config = statusConfig[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "w-2 h-2 rounded-full shrink-0",
          config.color,
          status === "valid" && "animate-pulse-dot"
        )}
      />
      {showLabel && (
        <span className="text-xs font-medium text-foreground">{config.label}</span>
      )}
    </span>
  );
}
