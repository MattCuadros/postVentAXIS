import { describe, expect, it } from "vitest";
import { matchOwner } from "@/lib/document-import/match";
import { parseDocument } from "@/lib/document-import/parsers";

describe("parseEmail: completa el propietario nuevo desde el remitente", () => {
  it("correo directo de un cliente, con teléfono en la firma: los tres campos completos", () => {
    const text = `Correo de Axis - Torre A 704
De: Juan Pérez <juanperez@correo.cl>
Enviado el: miércoles, 19 de agosto de 2026 15:57
Asunto: Torre A 704 / Filtración en baño

Hola, junto con saludar les informo que hay una filtración bajo el lavamanos del baño principal.

Saludos,
Juan Pérez
Cel: +56 9 8765 4321`;
    const parsed = parseDocument("EMAIL", text);
    expect(parsed.requirements).toHaveLength(1);
    const [requirement] = parsed.requirements;
    expect(requirement.ownerName).toBe("Juan Pérez");
    expect(requirement.ownerEmail).toBe("juanperez@correo.cl");
    expect(requirement.ownerPhone).toBe("+56987654321");
    expect(requirement.ownerFromSender).toBe(true);
  });

  it('reenvío "RV:" hecho por alguien @axisdc.cl con el correo original al final: usa el remitente original, nunca el interno', () => {
    const text = `RV: Torre B 302 / Ventana no cierra
De: Postventa Axis <postventa@axisdc.cl>
Enviado el: jueves, 20 de agosto de 2026 10:00
Asunto: RV: Torre B 302 / Ventana no cierra

Estimados, reenvío este correo del cliente.

De: María González <mgonzalez@correo.cl>
Enviado el: miércoles, 19 de agosto de 2026 09:00
Asunto: Torre B 302 / Ventana no cierra

Buenos días, la ventana corredera del dormitorio no cierra bien.

Atentamente,
María González
Fono: 987654321`;
    const parsed = parseDocument("EMAIL", text);
    const [requirement] = parsed.requirements;
    expect(requirement.ownerEmail).toBe("mgonzalez@correo.cl");
    expect(requirement.ownerName).toBe("María González");
    expect(requirement.ownerPhone).toBe("987654321");
  });

  it("correo con tabla de varios propietarios: correo vacío en todas las filas", () => {
    const text = `De: Administración Edificio <administracion@correo.cl>
Enviado el: lunes, 17 de agosto de 2026 08:00
Asunto: Reporte semanal de fallas - Edificio Mirador

Juan Pérez        405-C        +56987654321        Baño        Llave        Gotea la llave del lavamanos
María Soto        302-B        +56912345678        Cocina        Grifería        No sale agua caliente`;
    const parsed = parseDocument("EMAIL", text);
    expect(parsed.requirements.length).toBeGreaterThan(1);
    for (const requirement of parsed.requirements) {
      expect(requirement.ownerEmail).toBeNull();
      expect(requirement.ownerFromSender).toBeUndefined();
    }
  });

  it("remitente solo con correo, sin nombre: nombre vacío, correo completo", () => {
    const text = `De: contacto2026@correo.cl
Enviado el: martes, 18 de agosto de 2026 11:00
Asunto: Torre C 105 - Fisura en muro

Hay una fisura en el muro del living que va creciendo.`;
    const parsed = parseDocument("EMAIL", text);
    const [requirement] = parsed.requirements;
    expect(requirement.ownerEmail).toBe("contacto2026@correo.cl");
    expect(requirement.ownerName).toBeNull();
  });

  it("remitente que ya es propietario registrado: matchOwner lo encuentra sin duplicarlo", () => {
    const text = `De: Andrés Muñoz <amunoz@correo.cl>
Enviado el: viernes, 21 de agosto de 2026 09:00
Asunto: Torre A 704 - Puerta con problemas

La puerta principal no cierra bien, se traba.`;
    const parsed = parseDocument("EMAIL", text);
    const [requirement] = parsed.requirements;
    expect(requirement.ownerEmail).toBe("amunoz@correo.cl");

    const knownOwner = { id: "u-prop-1", name: "Andrés Muñoz", email: "amunoz@correo.cl", phone: "+56 9 1111 1111", role: "PROPIETARIO" as const, zoneIds: [], projectIds: [], active: true };
    const match = matchOwner(requirement.ownerEmail, [knownOwner], null);
    expect(match?.id).toBe("u-prop-1");
  });
});
