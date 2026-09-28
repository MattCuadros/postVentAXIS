import { describe, expect, it } from "vitest";
import { bannerState, parseMaintenanceFile } from "@/lib/maintenance";
import { anunciar, completar, pendientes, proximaVentana, quitar, registrar, vacio } from "../../scripts/mantenimiento.mjs";

describe("proximaVentana (04:00 hora de Chile)", () => {
  it("en horario de verano (UTC-3) son las 07:00 UTC", () => {
    expect(proximaVentana(new Date("2026-11-10T15:00:00Z")).toISOString()).toBe("2026-11-11T07:00:00.000Z");
  });

  it("en horario de invierno (UTC-4) son las 08:00 UTC", () => {
    expect(proximaVentana(new Date("2026-06-10T15:00:00Z")).toISOString()).toBe("2026-06-11T08:00:00.000Z");
  });

  it("antes de las 04:00 programa para el mismo día", () => {
    expect(proximaVentana(new Date("2026-11-10T05:00:00Z")).toISOString()).toBe("2026-11-10T07:00:00.000Z");
  });

  it("pasadas las 04:00 programa para el día siguiente", () => {
    expect(proximaVentana(new Date("2026-11-10T07:30:00Z")).toISOString()).toBe("2026-11-11T07:00:00.000Z");
  });
});

describe("agenda de mantenimiento", () => {
  const now = new Date("2026-11-10T15:00:00Z");

  it("anuncia, informa pendientes al llegar la hora y completa", () => {
    let datos = anunciar(vacio(), "programado/estadisticas", "Estadísticas del encargado", now);
    datos = anunciar(datos, "programado/estadisticas", "Estadísticas del encargado", now);
    expect(datos.programado).toHaveLength(1);
    expect(pendientes(datos, now)).toEqual([]);
    expect(pendientes(datos, new Date("2026-11-11T07:05:00Z"))).toEqual(["programado/estadisticas"]);

    const hecho = completar(datos, ["programado/estadisticas"], new Date("2026-11-11T07:20:00Z"));
    expect(hecho.programado).toEqual([]);
    expect(hecho.ultimo).toEqual({ completadoEn: "2026-11-11T07:20:00.000Z", novedades: ["Estadísticas del encargado"] });
  });

  it("quitar saca la rama sin registrar novedades", () => {
    const datos = quitar(anunciar(vacio(), "programado/x", "X", now), "programado/x");
    expect(datos).toEqual(vacio());
  });

  it("registrar anota una novedad ya desplegada sin agenda previa (despliegue inmediato)", () => {
    const datos = registrar(vacio(), "Estadísticas del encargado", new Date("2026-11-10T18:00:00Z"));
    expect(datos).toEqual({ programado: [], ultimo: { completadoEn: "2026-11-10T18:00:00.000Z", novedades: ["Estadísticas del encargado"] } });
  });
});

describe("bannerState", () => {
  const file = parseMaintenanceFile({
    programado: [{ rama: "programado/a", titulo: "Novedad A", inicio: "2026-11-11T07:00:00.000Z", duracionMinutos: 30 }],
    ultimo: { completadoEn: "2026-11-09T07:10:00.000Z", novedades: ["Anterior"] },
  });
  const builtAfter = new Date("2026-11-09T07:12:00Z");

  it("sin nada programado no muestra aviso", () => {
    expect(bannerState(parseMaintenanceFile({}), new Date(), builtAfter)).toEqual({ kind: "none" });
  });

  it("anuncia la ventana programada y luego el mantenimiento en curso", () => {
    expect(bannerState(file, new Date("2026-11-10T15:00:00Z"), builtAfter)).toMatchObject({ kind: "scheduled", novedades: ["Novedad A"] });
    expect(bannerState(file, new Date("2026-11-11T07:05:00Z"), builtAfter)).toMatchObject({ kind: "running" });
  });

  it("ofrece actualizar solo a quien tiene abierta una versión anterior al despliegue", () => {
    const builtBefore = new Date("2026-11-08T12:00:00Z");
    expect(bannerState(file, new Date("2026-11-09T12:00:00Z"), builtBefore)).toMatchObject({ kind: "updated", novedades: ["Anterior"] });
    expect(bannerState(file, new Date("2026-11-09T12:00:00Z"), builtAfter).kind).not.toBe("updated");
  });
});
