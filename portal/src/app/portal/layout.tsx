import { AppShell } from "@/components/layout/app-shell";
import { CartBranchSync } from "@/components/providers/cart-branch-sync";
import { requireProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  return (
    <>
      <CartBranchSync branchId={profile.branch_id} />
      <AppShell profile={profile} mode="portal">
        {children}
      </AppShell>
    </>
  );
}
