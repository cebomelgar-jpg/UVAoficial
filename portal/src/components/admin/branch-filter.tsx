import Link from "next/link";
import { MapPin } from "lucide-react";
import type { Branch } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BranchFilter({
  branches,
  activeSlug,
  basePath,
  extraParams,
  className,
}: {
  branches: Branch[];
  activeSlug?: string | null;
  basePath: string;
  extraParams?: Record<string, string | undefined>;
  className?: string;
}) {
  const options = [
    { slug: "", label: "Todas las sedes" },
    ...branches.map((branch) => ({ slug: branch.slug, label: branch.name })),
  ];

  function hrefFor(slug: string) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(extraParams ?? {})) {
      if (value) params.set(key, value);
    }
    if (slug) params.set("sede", slug);
    else params.delete("sede");
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  return (
    <div
      className={cn(
        "hide-scrollbar flex items-center gap-1 overflow-x-auto rounded-full border border-ink/10 bg-white/70 p-1 shadow-sm",
        className,
      )}
      aria-label="Filtrar por sede"
    >
      {options.map((option) => {
        const active = (activeSlug ?? "") === option.slug;
        return (
          <Link
            key={option.slug || "all"}
            href={hrefFor(option.slug)}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition",
              active
                ? "bg-ink text-paper shadow-card"
                : "text-muted hover:bg-ink/5 hover:text-ink",
            )}
          >
            {option.slug ? <MapPin className="size-3" /> : null}
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
