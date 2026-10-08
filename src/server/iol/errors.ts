/**
 * Error de la integración con IOL. `status` conserva el código HTTP de IOL cuando lo hay, para distinguir
 * un rechazo explícito (400/401) de un fallo temporal (timeout o 5xx, que se reportan como 503).
 * Los mensajes son para mostrar al usuario: nunca incluyen tokens ni datos de la cuenta.
 */
export class IolError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: IolErrorCode = status === 401 ? "not_connected" : status >= 500 ? "temporary" : "rejected",
  ) {
    super(message);
    this.name = "IolError";
  }

  get temporary(): boolean {
    return this.code === "temporary";
  }
}

export type IolErrorCode = "not_connected" | "expired" | "rejected" | "temporary" | "invalid_response";

export const temporaryError = () => new IolError(503, "IOL no está disponible en este momento. Intentá nuevamente", "temporary");
