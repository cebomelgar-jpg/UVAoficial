import { cn } from "@/lib/utils";
import type { ProfileStatus } from "@/lib/types";
import { PROFILE_STATUS_LABELS, PROFILE_STATUS_STYLES } from "@/lib/format";

export function ProfileStatusBadge({ status }: { status: ProfileStatus }) {
  return (
    <span
      className={cn(
        "badge border",
        PROFILE_STATUS_STYLES[status],
      )}
    >
      {PROFILE_STATUS_LABELS[status]}
    </span>
  );
}
