import { MapPin } from "lucide-react";
import type { Branch } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BranchBadge({
  branch,
  className,
  fallback = "Sin sede",
}: {
  branch?: Pick<Branch, "name" | "city"> | null;
  className?: string;
  fallback?: string;
}) {
  if (!branch) {
    return (
      <span className={cn("chip bg-ink/5 text-muted", className)}>
        <MapPin className="size-3" />
        {fallback}
      </span>
    );
  }

  return (
    <span
      className={cn("chip border border-purple/20 bg-purple-light/20 text-ink", className)}
      title={`${branch.name} · ${branch.city}`}
    >
      <MapPin className="size-3" />
      {branch.name}
    </span>
  );
}
