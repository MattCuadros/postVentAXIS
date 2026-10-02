import { beforeEach, describe, expect, it } from "vitest";
import { classifyAgentQuery, handleAgentMessage, resetAgentConversations } from "@/lib/agent-conversation";

const thread = () => crypto.randomUUID();

describe("local owner self-service assistant", () => {
  beforeEach(() => resetAgentConversations());

  it("resolves drain odor without creating a ticket when self-help works", () => {
    const id = thread();
    expect(handleAgentMessage(id, "Hay mal olor en el desagüe de la cocina").reply).toContain("drena lento");
    expect(handleAgentMessage(id, "Se usa poco, pero drena bien").reply).toContain("litros de agua");
    expect(handleAgentMessage(id, "Sigue igual").reply).toContain("rejilla");

    const resolved = handleAgentMessage(id, "Sí, se solucionó");
    expect(resolved.classification).toBe("RESOLVED");
    expect(resolved.draft).toBeUndefined();
  });

  it("asks for room and clarification before suggesting drain self-help", () => {
    const id = thread();
    expect(handleAgentMessage(id, "Siento mal olor en un desagüe").reply).toContain("¿En qué recinto");
    expect(handleAgentMessage(id, "En el baño").reply).toContain("drena lento");
  });

  it("escalates after two failed self-help attempts with editable ticket draft", () => {
    const id = thread();
    handleAgentMessage(id, "Mal olor en el desagüe de la cocina");
    handleAgentMessage(id, "Se usa poco y drena bien");
    handleAgentMessage(id, "No se solucionó");

    const escalated = handleAgentMessage(id, "No, sigue igual");
    expect(escalated.classification).toBe("ESCALATE");
    expect(escalated.draft?.categoryId).toBe("c-sanitarias");
    expect(escalated.draft?.room).toBe("Cocina");
    expect(escalated.draft?.description).toContain("Autogestión intentada");
  });

  it("asks about gas and checks before guiding around a heater", () => {
    const id = thread();
    expect(handleAgentMessage(id, "El calefón no prende en la cocina").reply).toContain("olor a gas");
    expect(handleAgentMessage(id, "No siento olor a gas").reply).toContain("otras llaves");
    expect(handleAgentMessage(id, "Sí, sale agua caliente en otras llaves").reply).toContain("alimentación eléctrica");
  });

  it("escalates uncertainty or suspected gas odor immediately with fixed safety advice", () => {
    const id = thread();
    handleAgentMessage(id, "El calefón no prende en la cocina");
    const emergency = handleAgentMessage(id, "Sí, siento olor a gas");
    expect(emergency.classification).toBe("ESCALATE");
    expect(emergency.reply).toContain("no enciendas llamas ni interruptores");
  });

  it("treats a gas leak as an emergency even if the owner says there is no odor", () => {
    const reply = handleAgentMessage(thread(), "No siento olor, pero hay una fuga de gas");
    expect(reply.classification).toBe("ESCALATE");
    expect(reply.reply).toContain("llama a emergencias desde afuera");
  });

  it.each([
    ["Hay chispas en el tablero eléctrico", "posible condición eléctrica"],
    ["El muro tiene grietas y se está cayendo", "riesgo estructural"],
    ["Hay una filtración activa grande", "filtración activa importante"],
  ])("escalates safety incident: %s", (message, expected) => {
    const reply = handleAgentMessage(thread(), message);
    expect(reply.classification).toBe("ESCALATE");
    expect(reply.reply).toContain(expected);
  });

  it("does not decide warranty coverage", () => {
    const reply = handleAgentMessage(thread(), "¿Esto lo cubre la garantía?");
    expect(reply.classification).toBe("ESCALATE");
    expect(reply.reply).toContain("no puede determinar cobertura");
  });

  it("offers a draft when the owner asks directly for human support", () => {
    const reply = handleAgentMessage(thread(), "Quiero que postventa revise este problema");
    expect(reply.classification).toBe("ESCALATE");
    expect(reply.draft).toBeDefined();
  });

  it("recognizes the expected issue from at least 19 of 20 representative phrases", () => {
    const cases: Array<[string, "mal-olor-desague" | "calefon-no-prende"]> = [
      ["olor a desagüe en el baño", "mal-olor-desague"],
      ["mal olor en desagüe", "mal-olor-desague"],
      ["huele mal la rejilla", "mal-olor-desague"],
      ["olor fuerte en el sifón", "mal-olor-desague"],
      ["el desagüe tiene mal olor", "mal-olor-desague"],
      ["olor a alcantarilla en la cocina", "mal-olor-desague"],
      ["olor desagradable en el baño", "mal-olor-desague"],
      ["drenaje con olor", "mal-olor-desague"],
      ["sale olor del desagüe", "mal-olor-desague"],
      ["olor en el lavaplatos", "mal-olor-desague"],
      ["calefón no enciende", "calefon-no-prende"],
      ["calefont no prende", "calefon-no-prende"],
      ["no tengo agua caliente", "calefon-no-prende"],
      ["el calentador de agua no funciona", "calefon-no-prende"],
      ["no sale agua caliente", "calefon-no-prende"],
      ["el calefón no calienta", "calefon-no-prende"],
      ["se apagó el calefón", "calefon-no-prende"],
      ["no prende el calefont", "calefon-no-prende"],
      ["falla de calefacción por agua caliente", "calefon-no-prende"],
      ["el calefón no enciende en la logia", "calefon-no-prende"],
    ];
    const correct = cases.filter(([query, expected]) => classifyAgentQuery(query) === expected).length;
    expect(correct).toBeGreaterThanOrEqual(19);
  });

  it("does not offer steps for unknown problems and offers the ticket form after clarification", () => {
    const id = thread();
    expect(handleAgentMessage(id, "Tengo un problema en mi vivienda").classification).toBe("CONVERSATION");
    const reply = handleAgentMessage(id, "Sigue pasando");
    expect(reply.classification).toBe("ESCALATE");
    expect(reply.draft?.categoryId).toBe("c-otros");
  });
});
