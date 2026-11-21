import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { AdhesionJourney } from "@/components/adhesion/adhesion-journey";
import { signOutAction } from "@/lib/actions/auth";
import { requireApplicant, getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AdhesionApplication } from "@/lib/types";

export const metadata: Metadata = {
  title: "Recorrido de adhesión",
};

export const dynamic = "force-dynamic";

export default async function AdhesionJourneyPage() {
  const profile = await requireApplicant();
  const user = await getCurrentUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("adhesion_applications")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();

  if (error) {
    console.error("[adhesion] No se pudo cargar el recorrido.", error.code);
    throw new Error("No pudimos cargar tu recorrido de adhesión.");
  }

  return (
    <div className="portal-canvas min-h-screen">
      <div className="pointer-events-none fixed inset-0 grain" />
      <main className="relative mx-auto w-full max-w-5xl space-y-6 px-5 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="btn-ghost btn-sm">
            <ArrowLeft className="size-3.5" />
            Sitio público
          </Link>
          <form action={signOutAction}>
            <button type="submit" className="btn-ghost btn-sm">
              <LogOut className="size-3.5" />
              Cerrar sesión
            </button>
          </form>
        </div>
        <AdhesionJourney
          application={(data as AdhesionApplication | null) ?? null}
          email={user?.email ?? profile.email ?? ""}
          rejected={profile.status === "rejected"}
        />
      </main>
    </div>
  );
}
