import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getGoogleConfig, safeReturnTo } from "@/server/auth/google-oidc";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeReturnTo(params.next ?? null);
  if (await getCurrentUser()) redirect(next);

  const configured = Boolean(getGoogleConfig());
  const loginUrl = `/api/auth/google/start?next=${encodeURIComponent(next)}`;
  const message = params.error === "not_allowed"
    ? "Esta cuenta de Google no tiene acceso a las secciones privadas."
    : params.error === "account_conflict"
      ? "No se pudo vincular esta cuenta. Contactá al administrador."
      : params.error
        ? "No se pudo completar el acceso. Intentá nuevamente."
        : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-12">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← Volver a Mirador</Link>
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Entrar a Mirador</h1>
        <p className="text-muted-foreground">Ingresá con una cuenta de Google autorizada para ver tus datos privados. Podés conectar IOL después, desde tu cuenta.</p>
      </div>
      {message && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">{message}</p>}
      {configured ? (
        <a href={loginUrl} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-foreground px-4 py-2 font-medium text-background hover:opacity-90">
          Continuar con Google
        </a>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">El acceso está temporalmente sin configurar.</p>
      )}
      <p className="text-sm text-muted-foreground">Inicio, Mercados, instrumentos, Aprender y Glosario son públicos.</p>
    </main>
  );
}
