import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Brand } from "@/components/brand";
import { verifySession } from "@/server/auth/session";

export const metadata: Metadata = { title: "Ingresar" };

export default async function LoginPage() {
  if (await verifySession()) redirect("/portfolio");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border bg-card p-6 shadow-sm">
        <Brand />
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Ver mi portafolio de IOL</h1>
          <p className="text-sm text-muted-foreground">
            Tu cartera real de InvertirOnline solo se muestra con sesión iniciada. El resto de la app no lo necesita.
          </p>
        </div>
        <LoginForm />
        <Link href="/portfolio" className="text-center text-xs text-muted-foreground hover:text-foreground">
          Volver a Portafolio
        </Link>
      </div>
    </main>
  );
}
