"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { IolError } from "./errors";
import { flowCookieSecure, IOL_CALLBACK_PATH, IOL_FLOW_COOKIE, iol } from "./index";
import { prismaIolStore } from "./prisma-store";
import { safeReturnTo } from "./session-service";

/** Conecta IOL a la cuenta Mirador autenticada mediante OAuth y PKCE. */
export async function connectIol(formData: FormData): Promise<void> {
  const user = await requireUser();
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""));
  const services = iol();
  if (!services) redirect(`${returnTo}?iol=not_configured`);

  let authorizeUrl: string;
  let state: string;
  try {
    ({ authorizeUrl, state } = await services.session.beginAuthorization(user.id, returnTo));
  } catch (e) {
    // Fuera del try queda el redirect: Next lo implementa con una excepción que no hay que atrapar.
    console.warn("[iol] no se pudo iniciar la conexión", e instanceof IolError ? e.status : "error");
    redirect(`${returnTo}?iol=${e instanceof IolError && e.temporary ? "unavailable" : "error"}`);
  }

  (await cookies()).set(IOL_FLOW_COOKIE, state, {
    httpOnly: true,
    secure: flowCookieSecure(),
    // Lax: IOL vuelve con una navegación GET de nivel superior, que sí lleva la cookie.
    sameSite: "lax",
    path: IOL_CALLBACK_PATH,
    maxAge: 10 * 60,
  });
  redirect(authorizeUrl);
}

/** Desconecta solo IOL de la cuenta Mirador autenticada. */
export async function disconnectIol(): Promise<void> {
  const user = await requireUser();
  // Desconectar sigue funcionando aunque falte temporalmente la configuración OAuth.
  const session = iol()?.session;
  if (session) await session.disconnect(user.id);
  else {
    await prismaIolStore.deletePendingForUser(user.id);
    await prismaIolStore.deleteConnection(user.id);
  }
  revalidatePath("/portfolio");
}
