"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { destroyIdentity, getOrCreateIdentity, verifySession } from "@/server/auth/session";
import { IolError } from "./errors";
import { flowCookieSecure, IOL_CALLBACK_PATH, IOL_FLOW_COOKIE, iol } from "./index";
import { safeReturnTo } from "./session-service";

/**
 * "Ver mi portafolio de IOL": el login es el de IOL. Se identifica al navegador (o se le crea una identidad
 * anónima), se registra el flujo y se redirige a IOL para el login y el consentimiento.
 * La contraseña de IOL nunca pasa por esta app.
 */
export async function connectIol(formData: FormData): Promise<void> {
  const returnTo = safeReturnTo(String(formData.get("returnTo") ?? ""));
  const services = iol();
  if (!services) redirect(`${returnTo}?iol=not_configured`);
  const user = await getOrCreateIdentity();

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

/** Desconecta IOL: borra la conexión, los tokens y la identidad de este navegador. */
export async function disconnectIol(): Promise<void> {
  const user = await verifySession();
  if (user) await destroyIdentity(user.id);
  revalidatePath("/portfolio");
}
