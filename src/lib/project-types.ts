import type { ProjectType, UnitType } from "@/types/domain";

export const PROJECT_TYPES: ProjectType[] = ["HABITACIONAL_EXTENSION", "HABITACIONAL_ALTURA", "RETAIL", "INSTITUCIONAL", "URBANIZACION", "OFICINAS", "INDUSTRIAL"];

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  HABITACIONAL_EXTENSION: "Habitacional extensión",
  HABITACIONAL_ALTURA: "Habitacional altura",
  RETAIL: "Retail",
  INSTITUCIONAL: "Institucional",
  URBANIZACION: "Urbanización",
  OFICINAS: "Oficinas",
  INDUSTRIAL: "Industrial",
};

export const UNIT_TYPE_LABEL: Record<UnitType, string> = {
  CASA: "Casa", DEPARTAMENTO: "Departamento", LOCAL: "Local", OFICINA: "Oficina", RECINTO: "Recinto", SECTOR: "Sector",
};

const UNIT_TYPES_BY_PROJECT: Record<ProjectType, UnitType[]> = {
  HABITACIONAL_EXTENSION: ["CASA"],
  HABITACIONAL_ALTURA: ["DEPARTAMENTO", "LOCAL"],
  RETAIL: ["LOCAL"],
  INSTITUCIONAL: ["RECINTO"],
  URBANIZACION: ["SECTOR"],
  OFICINAS: ["OFICINA", "LOCAL"],
  INDUSTRIAL: ["RECINTO"],
};

export function allowedUnitTypes(projectType: ProjectType): UnitType[] {
  return UNIT_TYPES_BY_PROJECT[projectType];
}

export function unitFields(unitType: UnitType): { tower: boolean; floor: boolean; number: boolean; freeText: boolean } {
  switch (unitType) {
    case "CASA": return { tower: false, floor: false, number: true, freeText: false };
    case "DEPARTAMENTO": return { tower: true, floor: true, number: true, freeText: false };
    case "OFICINA": return { tower: true, floor: true, number: true, freeText: false };
    case "LOCAL": return { tower: false, floor: true, number: true, freeText: false };
    case "RECINTO":
    case "SECTOR": return { tower: false, floor: false, number: false, freeText: true };
  }
}

export function ownerLabel(projectType: ProjectType): "Propietario" | "Administrador" {
  return projectType === "HABITACIONAL_EXTENSION" || projectType === "HABITACIONAL_ALTURA" ? "Propietario" : "Administrador";
}
