export type AgentClassification = "CONVERSATION" | "RESOLVED" | "ESCALATE";
export type AgentKind = "mal-olor-desague" | "calefon-no-prende" | "unknown";

export interface AgentDraft {
  categoryId: string;
  room: string;
  description: string;
}

export interface AgentReply {
  reply: string;
  classification: AgentClassification;
  draft?: AgentDraft;
}

interface KnowledgeEntry {
  id: Exclude<AgentKind, "unknown">;
  categoryId: string;
  title: string;
  keywords: string[];
  steps: string[];
  escalateIf: string;
}

interface Conversation {
  kind: AgentKind;
  initialDescription: string;
  room: string;
  stepIndex: number;
  failedAttempts: number;
  diagnosticPending: "room" | "drain-check" | "gas" | "other-taps" | null;
  diagnosticsComplete: boolean;
  turns: number;
  started: boolean;
  closed: boolean;
}

const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: "mal-olor-desague",
    categoryId: "c-sanitarias",
    title: "Mal olor en desagüe",
    keywords: [
      "olor desague",
      "olor a desague",
      "mal olor",
      "olor fuerte",
      "olor a alcantarilla",
      "olor desagradable",
      "huele mal",
      "drenaje con olor",
      "sale olor",
      "olor en lavaplatos",
      "desague tiene mal olor",
      "sifon",
      "rejilla",
    ],
    steps: [
      "Vierte entre 1 y 2 litros de agua en el desagüe y espera unos minutos.",
      "Si el olor continúa, retira la rejilla y limpia solo los residuos visibles. No desarmes cañerías.",
    ],
    escalateIf: "El olor persiste, aparece en varios artefactos o hay reflujo.",
  },
  {
    id: "calefon-no-prende",
    categoryId: "c-calefaccion",
    title: "Calefón no prende",
    keywords: [
      "calefon",
      "calefont",
      "no prende",
      "no enciende",
      "no calienta",
      "agua fria",
      "agua caliente",
      "no tengo agua caliente",
      "no sale agua caliente",
      "calentador de agua",
      "se apago el calefon",
      "ducha fria",
    ],
    steps: [
      "Sin tocar conexiones ni componentes internos, comprueba si el calefón tiene alimentación eléctrica o si sus pilas requieren cambio, según el manual del equipo.",
      "Revisa si la pantalla o el indicador muestra un código de error y consulta su significado en el manual de usuario. No abras el calefón ni manipules conexiones.",
    ],
    escalateIf: "No enciende después de las comprobaciones seguras o hay cualquier olor a gas.",
  },
];

const GAS_EMERGENCY =
  "Detectamos una posible emergencia por gas. Cierra el regulador solo si puedes hacerlo sin acercarte al olor ni ponerte en riesgo; ventila abriendo puertas o ventanas si están a mano, no enciendas llamas ni interruptores, sal del lugar y llama a emergencias desde afuera. No vuelvas a entrar. Esto requiere atención humana inmediata.";

const EMERGENCY_RULES: Array<{ pattern: RegExp; reply: string }> = [
  {
    pattern: /\b(fuga|escape)\s+de gas\b/i,
    reply: GAS_EMERGENCY,
  },
  {
    pattern: /\b(olor|huele|oloroso)\s+(a\s+)?gas\b|\bgas\s+(?:se\s+)?(siente|huele|escapa)\b/i,
    reply: GAS_EMERGENCY,
  },
  {
    pattern:
      /\b(tablero|cableado|enchufe|cable)\b.{0,40}\b(chisp\w*|humo|caliente|descarga)\b|\b(chisp\w*|humo|caliente)\b.{0,40}\b(tablero|cableado|enchufe|cable)\b|\b(descarga electrica|electrocut|cable pelado)\b/i,
    reply:
      "Hay una posible condición eléctrica peligrosa. Aléjate del área y no toques cables, enchufes ni equipos, especialmente si hay agua. Sal del lugar si existe riesgo inmediato y contacta a emergencias y a postventa. No intentes repararlo.",
  },
  {
    pattern:
      /\b(griet\w*|muro|techo|estructura)\b.{0,45}\b(colaps|desprend|ced|caida|cae)\b|\b(riesgo estructural|se esta cayendo)\b/i,
    reply:
      "Esto puede representar un riesgo estructural. Aléjate del área afectada y evita usarla; si hay riesgo inmediato, evacúa y llama a emergencias. Contacta a postventa para atención urgente. No intentes repararlo.",
  },
  {
    pattern:
      /\b(inundacion|filtracion|agua)\b.{0,60}\b(grande|activa|abundante|inunda|chorro)\b|\b(chorro de agua|se esta inundando)\b/i,
    reply:
      "Una filtración activa importante requiere atención humana urgente. Aléjate de equipos eléctricos mojados y no intentes reparar cañerías. Si hay riesgo para las personas, evacúa y llama a emergencias; contacta a postventa de inmediato.",
  },
];

const WARRANTY_RULE = /\b(garantia|cobertura|me cubre|esta cubierto)\b/i;
const HELP_RULE =
  /\b(quiero|necesito|solicito)\b.{0,35}\b(ayuda|requerimiento|visita|revisen?|persona|alguien)\b|\b(persona|humano|encargado)\b.{0,20}\b(hablar|ayuda|contactar)\b/i;
const SOLVED_RULE = /\b(si|solucionado|soluciono|resuelto|ya quedo|funciono)\b/i;
const FAILED_RULE = /\b(no|sigue|continua|igual|no funciono|no resulto)\b/i;
const GAS_NEGATION_RULE = /\b(no|nunca|sin)\b.{0,35}\b(olor|huele)\b.{0,15}\bgas\b/i;
const GAS_UNSURE_RULE = /\b(no se|no estoy seguro|no estoy segura|no sabria)\b/i;
const ROOMS: Array<[RegExp, string]> = [
  [/\bbano\b/i, "Baño"],
  [/\bcocina\b/i, "Cocina"],
  [/\blogia\b/i, "Logia"],
  [/\bliving\b/i, "Living"],
];

const conversations = new Map<string, Conversation>();

export class AgentCapacityError extends Error {
  constructor() {
    super("El prototipo alcanzó el límite de 100 conversaciones locales. Reinicia el servidor de desarrollo para liberar memoria.");
  }
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL");
}

function newConversation(): Conversation {
  return {
    kind: "unknown",
    initialDescription: "",
    room: "",
    stepIndex: -1,
    failedAttempts: 0,
    diagnosticPending: null,
    diagnosticsComplete: false,
    turns: 0,
    started: false,
    closed: false,
  };
}

function detectEmergency(message: string): string | undefined {
  const normalized = normalize(message);
  if (/\b(fuga|escape)\s+de gas\b/i.test(normalized)) return GAS_EMERGENCY;
  const gasNegated = GAS_NEGATION_RULE.test(normalized);
  for (const { pattern, reply } of EMERGENCY_RULES) {
    if (pattern === EMERGENCY_RULES[1].pattern && gasNegated) continue;
    if (pattern.test(normalized)) return reply;
  }
  return undefined;
}

export function classifyAgentQuery(message: string): AgentKind {
  const normalized = normalize(message);
  let winner: AgentKind = "unknown";
  let winningScore = 0;
  for (const entry of KNOWLEDGE) {
    const score = entry.keywords.reduce((total, keyword) => total + Number(normalized.includes(normalize(keyword))), 0);
    if (score > winningScore) {
      winner = entry.id;
      winningScore = score;
    }
  }
  return winner;
}

function detectRoom(message: string): string {
  const normalized = normalize(message);
  for (const [pattern, room] of ROOMS) {
    if (pattern.test(normalized)) return room;
  }
  return "";
}

function createDraft(state: Conversation): AgentDraft {
  const entry = KNOWLEDGE.find((item) => item.id === state.kind);
  const attemptedSteps = entry?.steps.slice(0, Math.max(state.stepIndex + 1, 0)) ?? [];
  return {
    categoryId: entry?.categoryId ?? "c-otros",
    room: state.room || "Otro",
    description: [
      `Descripción reportada: ${state.initialDescription}`,
      `Diagnóstico orientativo: ${entry?.title ?? "Requiere evaluación de postventa"}.`,
      `Autogestión intentada: ${attemptedSteps.length ? attemptedSteps.join("; ") : "No se realizaron pasos de autogestión."}`,
    ].join("\n").slice(0, 1000),
  };
}

function escalate(state: Conversation, reply: string): AgentReply {
  state.closed = true;
  return { reply, classification: "ESCALATE", draft: createDraft(state) };
}

function answer(state: Conversation, message: string): AgentReply {
  state.turns += 1;
  const normalizedMessage = normalize(message);

  const emergency = detectEmergency(message);
  if (emergency) {
    if (!state.started) {
      state.started = true;
      state.initialDescription = message.slice(0, 500);
      state.kind = classifyAgentQuery(message);
      state.room = detectRoom(message);
    } else if (!state.initialDescription.includes(message)) {
      state.initialDescription = `${state.initialDescription}\nRiesgo informado: ${message}`.slice(0, 500);
      state.kind = classifyAgentQuery(message);
      state.room = detectRoom(message);
    }
    return escalate(state, emergency);
  }

  if (WARRANTY_RULE.test(normalizedMessage)) {
    if (!state.started) {
      state.started = true;
      state.initialDescription = message.slice(0, 500);
    }
    state.kind = "unknown";
    return escalate(
      state,
      "El agente no puede determinar cobertura ni aceptar o rechazar una garantía. Postventa debe revisar el caso; puedes continuar al formulario para solicitar evaluación.",
    );
  }

  if (!state.started) {
    state.started = true;
    state.initialDescription = message.slice(0, 500);
    state.kind = classifyAgentQuery(message);
    state.room = detectRoom(message);
  } else if (state.kind === "unknown" && !state.initialDescription.includes(message)) {
    state.initialDescription = `${state.initialDescription}\nDetalle: ${message}`.slice(0, 500);
    const possibleKind = classifyAgentQuery(message);
    if (possibleKind !== "unknown") state.kind = possibleKind;
  }

  if (state.turns > 12) {
    return escalate(state, "La conversación llegó al límite de mensajes de este prototipo. Puedes continuar al formulario para que postventa lo revise.");
  }
  if (state.closed) return { reply: "Esta conversación ya terminó. Inicia una nueva para consultar otro problema.", classification: "RESOLVED" };

  if (HELP_RULE.test(normalizedMessage)) {
    return escalate(
      state,
      "De acuerdo. Puedes continuar al formulario para pedir que postventa revise el problema. Revisarás y confirmarás el requerimiento antes de enviarlo.",
    );
  }

  const entry = KNOWLEDGE.find((item) => item.id === state.kind);
  if (!entry) {
    if (state.failedAttempts >= 1) {
      return escalate(state, "Aún no puedo identificar una guía segura para este problema. Para que lo revise postventa, puedes continuar al formulario de requerimiento.");
    }
    state.failedAttempts += 1;
    return { reply: "Para orientarte con seguridad, cuéntame qué ocurre y en qué recinto. No incluyas datos personales.", classification: "CONVERSATION" };
  }

  if (state.diagnosticPending === "room") {
    state.room = state.room || detectRoom(message);
    if (!state.room) {
      return { reply: "¿En qué recinto ocurre el problema? Indica, por ejemplo, baño, cocina o logia.", classification: "CONVERSATION" };
    }
    if (entry.id === "calefon-no-prende" && GAS_NEGATION_RULE.test(normalizedMessage)) {
      state.diagnosticPending = "other-taps";
      return { reply: "¿En otras llaves de la vivienda sale agua caliente?", classification: "CONVERSATION" };
    }
    state.diagnosticPending = null;
  } else if (state.diagnosticPending === "drain-check") {
    state.diagnosticPending = null;
    state.diagnosticsComplete = true;
  } else if (state.diagnosticPending === "gas") {
    if (GAS_UNSURE_RULE.test(normalizedMessage)) {
      return escalate(state, "Si no estás seguro de que no haya olor a gas, no hagas comprobaciones. Aléjate del calefón y solicita ayuda inmediata a postventa.");
    }
    if (!GAS_NEGATION_RULE.test(normalizedMessage) && !/^\s*no[.!]?\s*$/i.test(normalizedMessage)) {
      if (/\b(si|hay|siento|huele|olor)\b/i.test(normalizedMessage)) return escalate(state, GAS_EMERGENCY);
      return { reply: "Necesito confirmar si no hay olor a gas antes de seguir. Si no estás seguro, no manipules el calefón y solicita ayuda a postventa.", classification: "CONVERSATION" };
    }
    state.diagnosticPending = "other-taps";
    return { reply: "¿En otras llaves de la vivienda sale agua caliente?", classification: "CONVERSATION" };
  } else if (state.diagnosticPending === "other-taps") {
    if (/\b(no|nunca|ninguna)\b/i.test(normalizedMessage)) {
      return escalate(state, "Si tampoco hay agua caliente en las otras llaves, no hagas más comprobaciones del calefón. Postventa debe revisar el suministro y el equipo; puedes continuar al formulario.");
    }
    state.diagnosticPending = null;
    state.diagnosticsComplete = true;
  }

  state.room = state.room || detectRoom(message);
  if (!state.diagnosticsComplete) {
    if (!state.room) {
      state.diagnosticPending = "room";
      return { reply: entry.id === "calefon-no-prende" ? "¿En qué recinto está el calefón?" : "¿En qué recinto ocurre el problema?", classification: "CONVERSATION" };
    }
    if (entry.id === "mal-olor-desague") {
      state.diagnosticPending = "drain-check";
      return { reply: "¿El artefacto se usa poco o estuvo vacío por un tiempo? ¿El agua drena lento?", classification: "CONVERSATION" };
    }
    if (entry.id === "calefon-no-prende") {
      if (GAS_NEGATION_RULE.test(normalize(state.initialDescription))) {
        state.diagnosticPending = "other-taps";
        return { reply: "¿En otras llaves de la vivienda sale agua caliente?", classification: "CONVERSATION" };
      }
      state.diagnosticPending = "gas";
      return { reply: "¿Sientes olor a gas? Si la respuesta es sí o no estás seguro, no hagas comprobaciones y avísame.", classification: "CONVERSATION" };
    }
  }

  if (state.stepIndex === -1) {
    state.stepIndex = 0;
    return { reply: `${entry.steps[0]} Cuando termines, dime si se solucionó o si el problema continúa.`, classification: "CONVERSATION" };
  }

  if (FAILED_RULE.test(normalizedMessage)) {
    state.failedAttempts += 1;
    if (state.failedAttempts >= 2 || state.stepIndex + 1 >= entry.steps.length) {
      return escalate(state, `Gracias por probarlo. Como el problema continúa, corresponde que lo revise postventa. ${entry.escalateIf} Puedes continuar al formulario; revisarás y confirmarás el requerimiento antes de enviarlo.`);
    }
    state.stepIndex += 1;
    return { reply: `Probemos una última acción segura: ${entry.steps[state.stepIndex]} Cuando termines, dime si se solucionó o si continúa.`, classification: "CONVERSATION" };
  }

  if (SOLVED_RULE.test(normalizedMessage)) {
    state.closed = true;
    return { reply: "¡Qué bueno que se solucionó! No crearé un requerimiento. Si vuelve a ocurrir, puedes volver a consultar.", classification: "RESOLVED" };
  }

  return { reply: "¿Pudiste hacer el paso? Cuéntame si se solucionó o si el problema continúa.", classification: "CONVERSATION" };
}

export function handleAgentMessage(threadId: string, message: string): AgentReply {
  let conversation = conversations.get(threadId);
  if (!conversation) {
    if (conversations.size >= 100) {
      throw new AgentCapacityError();
    }
    conversation = newConversation();
    conversations.set(threadId, conversation);
  }
  return answer(conversation, message);
}

export function resetAgentConversations(): void {
  conversations.clear();
}
