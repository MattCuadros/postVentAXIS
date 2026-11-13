import { describe, expect, it } from "vitest";
import { reducer, createSeedState } from "@/data/store";
import { googleLoginErrorMessage, parseGoogleLoginError, readLinkResult, readProfile } from "@/lib/google-auth";
import { decideRoute } from "@/proxy";

describe("ingreso con Google: respuestas de la base de datos", () => {
  it("acepta un vínculo OK con rol válido y rechaza todo lo demás", () => {
    expect(readLinkResult({ status: "OK", id: "u-1", role: "ENCARGADO" })).toEqual({ ok: true, userId: "u-1", role: "ENCARGADO" });
    expect(readLinkResult({ status: "DOMINIO" })).toEqual({ ok: false, error: "DOMINIO" });
    expect(readLinkResult({ status: "NO_REGISTRADO" })).toEqual({ ok: false, error: "NO_REGISTRADO" });
    expect(readLinkResult({ status: "INACTIVO" })).toEqual({ ok: false, error: "INACTIVO" });
    expect(readLinkResult({ status: "OK", id: "u-1", role: "JEFE" })).toEqual({ ok: false, error: "ERROR" });
    expect(readLinkResult({ status: "OK", role: "ADMIN" })).toEqual({ ok: false, error: "ERROR" });
    expect(readLinkResult({ status: "ALGO_NUEVO" })).toEqual({ ok: false, error: "ERROR" });
    expect(readLinkResult(null)).toEqual({ ok: false, error: "ERROR" });
  });

  it("lee el perfil del directorio como usuario de la app", () => {
    expect(readProfile({ id: "u-9", name: "Ana", email: "ana@axisdc.cl", phone: "1", role: "ENCARGADO", active: true, zone_ids: ["z-centro", 3], project_ids: null }))
      .toEqual({ id: "u-9", name: "Ana", email: "ana@axisdc.cl", phone: "1", role: "ENCARGADO", active: true, zoneIds: ["z-centro"], projectIds: [] });
    expect(readProfile({ id: "u-9", name: "Ana", email: "ana@axisdc.cl", role: "OTRO" })).toBeNull();
    expect(readProfile(null)).toBeNull();
  });

  it("cada motivo de rechazo tiene mensaje; un código desconocido cae en el genérico", () => {
    expect(parseGoogleLoginError(null)).toBeNull();
    expect(parseGoogleLoginError("NO_REGISTRADO")).toBe("NO_REGISTRADO");
    expect(parseGoogleLoginError("<script>")).toBe("ERROR");
    expect(googleLoginErrorMessage("DOMINIO")).toContain("@axisdc.cl");
    expect(googleLoginErrorMessage("NO_REGISTRADO")).toContain("superadministrador");
  });
});

describe("ingreso con Google: datos locales y rutas", () => {
  it("UPSERT_USER agrega al usuario del directorio o lo actualiza sin duplicarlo", () => {
    const seed = createSeedState();
    const nuevo = { id: "dir-1", name: "Ana", email: "ana@axisdc.cl", phone: "1", role: "ENCARGADO" as const, zoneIds: ["z-centro"], projectIds: [], active: true };
    const added = reducer(seed, { type: "UPSERT_USER", user: nuevo });
    expect(added.users).toHaveLength(seed.users.length + 1);
    const updated = reducer(added, { type: "UPSERT_USER", user: { ...nuevo, role: "ADMIN", zoneIds: [] } });
    expect(updated.users).toHaveLength(seed.users.length + 1);
    expect(updated.users.find((user) => user.id === "dir-1")?.role).toBe("ADMIN");
    // Mismo correo con otro id (alta local previa): gana el del directorio, sin duplicar el correo.
    const replaced = reducer(added, { type: "UPSERT_USER", user: { ...nuevo, id: "dir-2", email: "ANA@axisdc.cl" } });
    expect(replaced.users.filter((user) => user.email.toLowerCase() === "ana@axisdc.cl").map((user) => user.id)).toEqual(["dir-2"]);
  });

  it("/auth/* pasa con o sin sesión, también fuera del modo pruebas", () => {
    for (const testMode of [true, false]) {
      expect(decideRoute("/auth/callback", undefined, undefined, testMode)).toEqual({ action: "next" });
      expect(decideRoute("/auth/listo", "u-admin", "ADMIN", testMode)).toEqual({ action: "next" });
    }
    expect(decideRoute("/admin", undefined, undefined, false)).toEqual({ action: "redirect", to: "/login" });
  });
});
