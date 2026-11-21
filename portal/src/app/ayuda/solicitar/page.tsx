import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SupportContactForm } from "@/components/support/support-contact-form";
import { Logo } from "@/components/ui/logo";

export const metadata: Metadata = {
  title: "Solicitar ayuda",
};

export default async function SupportRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  const initialRequestType =
    motivo === "privacy" ||
    motivo === "general" ||
    motivo === "problem" ||
    motivo === "product"
      ? motivo
      : "password";

  return (
    <div className="portal-canvas min-h-screen">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-6 sm:px-8">
        <Logo />
        <Link href="/login" className="btn-ghost btn-sm">
          <ArrowLeft className="size-3.5" />
          Ingresar
        </Link>
      </header>
      <main className="mx-auto w-full max-w-xl px-5 pb-16 sm:px-8">
        <SupportContactForm initialRequestType={initialRequestType} />
      </main>
    </div>
  );
}
