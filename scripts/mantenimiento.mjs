#!/usr/bin/env node
/**
 * Programa y cierra las ventanas de mantenimiento que anuncia el banner de la app
 * (public/mantenimiento.json). Lo usan los workflows de GitHub Actions:
 *
 *   node scripts/mantenimiento.mjs anunciar <rama> "<título>"   → agenda la rama para las próximas 04:00 (Chile)
 *   node scripts/mantenimiento.mjs pendientes                   → ramas cuya hora ya llegó (una por línea)
 *   node scripts/mantenimiento.mjs completar <rama> [<rama>…]   → las saca de la agenda y registra las novedades
 *   node scripts/mantenimiento.mjs quitar <rama>                → la saca de la agenda sin desplegarla
 *   node scripts/mantenimiento.mjs registrar "<título>"         → registra una novedad ya desplegada (despliegue inmediato, sin agenda previa)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const ZONA = "America/Santiago";
export const HORA_MANTENIMIENTO = 4;
export const DURACION_MINUTOS = 30;
const ARCHIVO = fileURLToPath(new URL("../public/mantenimiento.json", import.meta.url));

/** Partes de la fecha/hora de pared en Chile para un instante dado. */
function partesEnChile(fecha) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(fecha);
  const valor = (tipo) => Number(partes.find((parte) => parte.type === tipo).value);
  return { anio: valor("year"), mes: valor("month"), dia: valor("day"), hora: valor("hour"), minuto: valor("minute") };
}

/** Instante UTC en que en Chile son las `hora`:00 del día indicado (prueba UTC-3 y UTC-4). */
function aUtc(anio, mes, dia, hora) {
  for (const desfase of [3, 4, 2, 5]) {
    const candidato = new Date(Date.UTC(anio, mes - 1, dia, hora + desfase));
    const enChile = partesEnChile(candidato);
    if (enChile.dia === dia && enChile.hora === hora) return candidato;
  }
  throw new Error(`No se pudo convertir ${anio}-${mes}-${dia} ${hora}:00 de Chile a UTC`);
}

/** Próximas 04:00 de Chile estrictamente después de `ahora`. */
export function proximaVentana(ahora = new Date()) {
  const hoy = partesEnChile(ahora);
  const deHoy = aUtc(hoy.anio, hoy.mes, hoy.dia, HORA_MANTENIMIENTO);
  if (deHoy > ahora) return deHoy;
  const manana = new Date(Date.UTC(hoy.anio, hoy.mes - 1, hoy.dia + 1));
  return aUtc(manana.getUTCFullYear(), manana.getUTCMonth() + 1, manana.getUTCDate(), HORA_MANTENIMIENTO);
}

export function vacio() {
  return { programado: [], ultimo: null };
}

export function leer() {
  try {
    const datos = JSON.parse(readFileSync(ARCHIVO, "utf8"));
    return { programado: Array.isArray(datos.programado) ? datos.programado : [], ultimo: datos.ultimo ?? null };
  } catch {
    return vacio();
  }
}

function guardar(datos) {
  writeFileSync(ARCHIVO, `${JSON.stringify(datos, null, 2)}\n`);
}

export function anunciar(datos, rama, titulo, ahora = new Date()) {
  const inicio = proximaVentana(ahora).toISOString();
  const resto = datos.programado.filter((item) => item.rama !== rama);
  return { ...datos, programado: [...resto, { rama, titulo, inicio, duracionMinutos: DURACION_MINUTOS }] };
}

export function pendientes(datos, ahora = new Date()) {
  return datos.programado.filter((item) => new Date(item.inicio) <= ahora).map((item) => item.rama);
}

export function completar(datos, ramas, ahora = new Date()) {
  const hechas = datos.programado.filter((item) => ramas.includes(item.rama));
  return {
    programado: datos.programado.filter((item) => !ramas.includes(item.rama)),
    ultimo: hechas.length === 0 ? datos.ultimo : { completadoEn: ahora.toISOString(), novedades: hechas.map((item) => item.titulo) },
  };
}

export function quitar(datos, rama) {
  return { ...datos, programado: datos.programado.filter((item) => item.rama !== rama) };
}

/** Registra una novedad ya desplegada (despliegue inmediato), sin haber pasado por `anunciar`. */
export function registrar(datos, titulo, ahora = new Date()) {
  return { ...datos, ultimo: { completadoEn: ahora.toISOString(), novedades: [titulo] } };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [comando, ...args] = process.argv.slice(2);
  const datos = leer();
  if (comando === "anunciar" && args[0]) {
    const siguiente = anunciar(datos, args[0], args[1] || args[0]);
    guardar(siguiente);
    console.log(siguiente.programado.find((item) => item.rama === args[0]).inicio);
  } else if (comando === "pendientes") {
    for (const rama of pendientes(datos)) console.log(rama);
  } else if (comando === "completar" && args.length > 0) {
    guardar(completar(datos, args));
  } else if (comando === "quitar" && args[0]) {
    guardar(quitar(datos, args[0]));
  } else if (comando === "registrar" && args[0]) {
    guardar(registrar(datos, args[0]));
  } else {
    console.error("Uso: anunciar <rama> <título> | pendientes | completar <rama…> | quitar <rama> | registrar <título>");
    process.exit(1);
  }
}
