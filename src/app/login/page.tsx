import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Brand } from "@/components/brand";
import { verifySession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await verifySession()) redirect("/");
  const { next } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border bg-card p-6 shadow-sm">
        <Brand />
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Ingresá a tu cuenta</h1>
          <p className="text-sm text-muted-foreground">Tu cartera y tus datos de IOL solo se ven con sesión iniciada.</p>
        </div>
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </div>
    </main>
  );
}
