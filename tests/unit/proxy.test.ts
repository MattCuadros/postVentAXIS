import { afterEach, describe, expect, it, vi } from "vitest";
import { signInWithPassword } from "@/data/auth";
import { isTestMode } from "@/lib/app-mode";
import { fieldErrors, loginSchema } from "@/lib/schemas";
import { decideRoute } from "@/proxy";

const NEXT = { action: "next" };
const to = (path: string) => ({ action: "redirect", to: path });

describe("decideRoute sin sesión", () => {
  it("modo pruebas encendido: /login y /pruebas son accesibles; lo demás va a /login", () => {
    expect(decideRoute("/login", undefined, undefined, true)).toEqual(NEXT);
    expect(decideRoute("/pruebas", undefined, undefined, true)).toEqual(NEXT);
    expect(decideRoute("/", undefined, undefined, true)).toEqual(to("/login"));
    expect(decideRoute("/admin", undefined, undefined, true)).toEqual(to("/login"));
    expect(decideRoute("/propietario/tickets/t-1", undefined, undefined, true)).toEqual(to("/login"));
  });

  it("modo pruebas apagado: /login accesible y /pruebas redirige a /login", () => {
    expect(decideRoute("/login", undefined, undefined, false)).toEqual(NEXT);
    expect(decideRoute("/pruebas", undefined, undefined, false)).toEqual(to("/login"));
    expect(decideRoute("/admin", undefined, undefined, false)).toEqual(to("/login"));
  });

  it("una cookie de rol inválida cuenta como sin sesión", () => {
    expect(decideRoute("/admin", "u-1", "HACKER", true)).toEqual(to("/login"));
    expect(decideRoute("/login", "u-1", "HACKER", true)).toEqual(NEXT);
  });
});

describe("decideRoute con sesión", () => {
  it("/, /login y /pruebas van a la home del rol", () => {
    for (const testMode of [true, false]) {
      expect(decideRoute("/", "u-enc", "ENCARGADO", testMode)).toEqual(to("/encargado"));
      expect(decideRoute("/login", "u-enc", "ENCARGADO", testMode)).toEqual(to("/encargado"));
    }
    expect(decideRoute("/pruebas", "u-enc", "ENCARGADO", true)).toEqual(to("/encargado"));
  });

  it("con el modo pruebas apagado, /pruebas redirige siempre a /login (y /login ya lleva a la home)", () => {
    expect(decideRoute("/pruebas", "u-enc", "ENCARGADO", false)).toEqual(to("/login"));
  });

  it("cada rol ve solo su sección", () => {
    expect(decideRoute("/encargado/calendario", "u-enc", "ENCARGADO", true)).toEqual(NEXT);
    expect(decideRoute("/admin", "u-enc", "ENCARGADO", true)).toEqual(to("/encargado"));
    expect(decideRoute("/admin-obra", "u-ao", "ADMIN_OBRA", true)).toEqual(NEXT);
    expect(decideRoute("/admin", "u-ao", "ADMIN_OBRA", true)).toEqual(to("/admin-obra"));
    expect(decideRoute("/propietario/nuevo", "u-p", "PROPIETARIO", true)).toEqual(NEXT);
  });
});

describe("isTestMode", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("es true salvo que la variable valga exactamente \"false\"", () => {
    vi.stubEnv("NEXT_PUBLIC_MODO_PRUEBAS", undefined as unknown as string);
    expect(isTestMode()).toBe(true);
    for (const value of ["true", "", "0", "FALSE", "no"]) {
      vi.stubEnv("NEXT_PUBLIC_MODO_PRUEBAS", value);
      expect(isTestMode(), value).toBe(true);
    }
    vi.stubEnv("NEXT_PUBLIC_MODO_PRUEBAS", "false");
    expect(isTestMode()).toBe(false);
  });
});

describe("loginSchema", () => {
  it("exige correo y contraseña", () => {
    const empty = loginSchema.safeParse({ email: "", password: "" });
    expect(empty.success).toBe(false);
    if (!empty.success) expect(fieldErrors(empty.error)).toEqual({ email: "Ingresa tu correo.", password: "Ingresa tu contraseña." });
  });

  it("valida el formato del correo y recorta espacios", () => {
    expect(loginSchema.safeParse({ email: "sin-arroba", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b", password: "x" }).success).toBe(false);
    const ok = loginSchema.safeParse({ email: "  persona@correo.cl ", password: "  con espacios  " });
    expect(ok.success && ok.data).toEqual({ email: "persona@correo.cl", password: "  con espacios  " });
  });
});

describe("signInWithPassword (adaptador sin backend)", () => {
  it("responde NO_DISPONIBLE y no crea sesión", async () => {
    expect(await signInWithPassword("persona@correo.cl", "clave")).toEqual({ ok: false, reason: "NO_DISPONIBLE" });
  });
});
