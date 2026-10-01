import { delay } from "@/lib/delay";

export type SignInResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "CREDENCIALES_INVALIDAS" | "NO_DISPONIBLE" | "ERROR_RED" };

/**
 * Punto único de integración del login con correo y contraseña.
 *
 * Hoy, sin backend, no hay contraseñas que validar: siempre responde NO_DISPONIBLE. Con backend,
 * aquí va la llamada al servidor (por HTTPS, sin registrar ni guardar la contraseña en ningún
 * lado) y la sesión pasa a ser una cookie firmada emitida por el servidor; hoy la sesión es la
 * cookie simulada de `session-context.tsx` (`pv_user_id` y `pv_role`).
 *
 * Regla: la contraseña no se persiste (ni localStorage, ni datos semilla, ni "claves de demo") y
 * no se escribe en consola. Este archivo es lo único que la recibe.
 */
export async function signInWithPassword(email: string, password: string): Promise<SignInResult> {
  void email;
  void password;
  await delay();
  return { ok: false, reason: "NO_DISPONIBLE" };
}
