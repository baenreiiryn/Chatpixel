import {
  executeCommand,
  requestPlayerRoll,
  type DiceType,
  type GameState,
  type RollKind,
  type TimelineEntry,
  type TimelineKind,
} from "@/lib/game";
import {
  addCalendarEvent,
  advanceCampaignTime,
  deriveCampaignDateTime,
  formatCampaignDateTime,
  removeCalendarEvent,
  setCampaignWeather,
  updateCalendarEvent,
  type CampaignCalendarEvent,
  type CalendarEventKind,
  type WeatherCondition,
} from "@/lib/campaignTime";
import { parseDiceFormula, type ParsedDiceFormula } from "@/lib/dice";
import { formatTimelineEntryDate, timelineEntrySortValue, worldDateOrdinalMinute } from "@/lib/timeline";
import { oracleTools } from "@/lib/tools";

const WEATHER_CONDITIONS: WeatherCondition[] = [
  "clear",
  "partly-cloudy",
  "cloudy",
  "rain",
  "storm",
  "snow",
  "fog",
  "wind",
  "custom",
];
const WEATHER_INTENSITIES = ["light", "moderate", "heavy"] as const;
const CALENDAR_EVENT_KINDS: CalendarEventKind[] = ["quest", "effect", "appointment", "world", "custom"];
const DICE_TYPES: DiceType[] = ["d2", "d4", "d6", "d8", "d10", "d12", "d20", "d100"];
const ROLL_KINDS: RollKind[] = ["attack", "damage", "reaction", "check", "duality", "custom"];
const TIMELINE_KINDS: TimelineKind[] = ["discovery", "quest", "combat", "travel", "relationship", "world", "milestone", "other"];

function normalizeTimelineText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export const responseTools = oracleTools.map((tool) => ({
  type: "function",
  name: tool.name,
  description: tool.description,
  parameters: tool.inputSchema,
}));

export function gmInstructions(system: string) {
  return [
    "Você é o Mestre de RPG do OracleRPG.",
    `O sistema atual é ${system}.`,
    "Narre em português brasileiro com clareza e atmosfera, sem controlar as decisões do personagem do jogador.",
    "Texto do jogador entre **asteriscos duplos** descreve explicitamente uma ação do personagem; interprete **texto** como algo que o personagem faz. Texto fora desses marcadores pode ser fala, intenção ou comentário e deve ser interpretado pelo contexto.",
    "O OracleRPG é a fonte da verdade para estado mecânico, inventário, missões e memória.",
    "Use ferramentas sempre que uma ação alterar dados persistentes ou quando precisar consultar memória.",
    "Quando a narração indicar passagem de tempo, avance o relógio da campanha pelo tempo transcorrido descrito, inclusive minutos, horas ou dias.",
    "Se advance_time retornar reachedEvents, esses prazos ou efeitos chegaram ao fim durante a passagem de tempo e devem ser considerados na narração e no estado.",
    "Quando a narração mudar o clima, atualize o clima persistido da campanha para refletir a nova condição.",
    "Use eventos do calendário para prazos de missões, buffs, efeitos temporários e acontecimentos futuros que dependam do tempo da campanha.",
    "Quando o grupo aceitar uma nova missão, registre-a com quest_add; se houver prazo, informe deadlineMinutes para que o Oracle crie o prazo no calendário automaticamente.",
    "Para eventos relativos ao momento atual, prefira startsInMinutes e durationMinutes em vez de calcular datas manualmente.",
    "Não invente valores mecânicos que já estejam no contexto.",
    "Quando o desfecho depender de uma rolagem do jogador, use request_player_roll. Nunca role pelo jogador nem invente o resultado.",
    "Ao chamar request_player_roll, encerre a resolução naquele ponto e aguarde o jogador fornecer o resultado. Não narre sucesso, falha, dano ou consequência da rolagem no mesmo turno.",
    "Se pendingRoll estiver preenchido no estado, a cena está aguardando essa rolagem: não solicite outra e não avance suas consequências até receber o resultado.",
    "Quando pendingRoll desaparecer e o resultado aparecer em rollHistory, continue a cena a partir daquele resultado. Você pode narrar brevemente a consequência e então pedir outra rolagem quando a sequência exigir, por exemplo ataque acertou e agora requer dano.",
    "Em Daggerheart, pedidos de Dualidade devem usar rollKind duality e uma fórmula com exatamente 2d12 para Esperança e Medo; dados auxiliares e modificadores podem ser acrescentados à mesma fórmula.",
    "Faça alterações mecânicas antes de narrar seus efeitos quando isso for necessário.",
    "Registre em memória apenas fatos relevantes que precisem sobreviver ao contexto recente.",
    "O timeline da aba Memória é a cronologia curta e visível do jogador. Quando algo importante acontecer ou for descoberto — uma pista, encontro decisivo, missão, viagem marcante, mudança de relação ou marco da campanha — registre o acontecimento com timeline_entry_add após ele estar estabelecido.",
    "Cada entrada do timeline deve conter apenas UM acontecimento ou fato histórico. Se o mesmo trecho revelar vários fatos (por exemplo: alguém salvou um reino e depois fundou uma academia), faça chamadas separadas, mesmo que você atribua a mesma data aos dois.",
    "Nunca cole o texto inteiro de uma memória, do gancho da aventura ou da história do personagem no timeline. Extraia o acontecimento, dê um título curto e descreva-o em no máximo duas frases objetivas.",
    "Ao registrar retroativamente um fato histórico sem data exata, estipule uma data plausível e coerente com a cronologia. Use year/monthIndex/day/hour/minute em timeline_entry_add. É permitido estipular anos antigos e usar a mesma data em acontecimentos distintos.",
    "Um fato histórico descoberto agora deve aparecer na data histórica estimada em que ocorreu; uma descoberta que só existe no presente usa a data atual.",
    "Não transforme cada batida da narração em timeline. Registre apenas acontecimentos que ajudam o jogador a entender a história depois.",
    "Aceitar, concluir ou falhar uma missão normalmente merece uma entrada de timeline quando isso for relevante ao histórico da campanha.",
    "Timeline e memória têm papéis diferentes: timeline é player-facing e cronológico; memory_record é para fatos persistentes, segredos e detalhes úteis ao Mestre. Não duplique o mesmo texto nos dois sem necessidade.",
    "Não coloque segredos ainda desconhecidos no timeline público. Se precisar pré-registrar algo oculto, use visibility hidden e revele depois com timeline_entry_set_visibility.",
    "Eventos futuros pertencem ao calendário. timeline_entry_add só registra algo que já aconteceu ou foi descoberto; avance o tempo primeiro quando a ficção tiver passado tempo.",
    "Quando uma característica visual estável de um personagem for estabelecida pela primeira vez, registre-a como memória visual.",
    "Não revele segredos que o personagem não teria como saber.",
    "Formate a resposta em parágrafos curtos. Separe sempre narração e fala em parágrafos distintos.",
    "Quando um NPC falar, coloque a fala em um parágrafo próprio, preferencialmente iniciada por travessão.",
    "Nunca entregue narração e várias falas como um único bloco corrido.",
    "Depois das ferramentas, produza a narração final e, quando apropriado, pergunte o que o jogador faz. A exceção é request_player_roll: após essa ferramenta, pare e aguarde a rolagem sem continuar a narração.",
  ].join("\n");
}

export function buildTurnInput(state: GameState, playerText: string) {
  const recent = state.messages.slice(-12).map((message) => ({
    role: message.role,
    text: message.text,
  }));
  const campaignTime = "time" in state ? state.time : undefined;
  const currentDate = campaignTime ? deriveCampaignDateTime(campaignTime) : undefined;
  return [{
    role: "user",
    content: [
      "ESTADO ATUAL DO ORACLE:",
      JSON.stringify({
        campaign: state.campaign,
        character: state.character,
        inventory: state.inventory,
        activeQuests: state.quests.filter((quest) => quest.status === "active"),
        npcs: state.npcs,
        memories: state.memories.slice(0, 20),
        timeline: (state.timeline ?? []).slice(-20),
        time: campaignTime ? {
          ...campaignTime,
          currentDate,
          currentDateLabel: formatCampaignDateTime(campaignTime),
        } : undefined,
        recentDialogue: recent,
        pendingRoll: state.pendingRoll ?? null,
        rollHistory: (state.rollHistory ?? []).slice(-12),
      }),
      "",
      `MENSAGEM DO JOGADOR: ${playerText}`,
    ].join("\n"),
  }];
}

export function executeGmTool(
  state: GameState,
  name: string,
  rawArguments: string,
): { state: GameState; result: unknown } {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(rawArguments || "{}");
  } catch {
    return { state, result: { ok: false, error: "Invalid JSON arguments." } };
  }

  if (name === "request_player_roll") {
    const label = String(args.label || "").trim();
    const reason = String(args.reason || "").trim();
    const formula = typeof args.formula === "string" ? args.formula.trim() : "";
    const allowedDice = Array.isArray(args.allowedDice)
      ? args.allowedDice.map((die) => String(die) as DiceType)
      : [];
    const rollKind = args.rollKind === undefined ? "custom" : String(args.rollKind) as RollKind;
    const targetArg = args.target === undefined ? undefined : Number(args.target);
    const dcArg = args.dc === undefined ? undefined : Number(args.dc);
    let parsedFormula: ParsedDiceFormula | undefined;
    if (!label || !reason || (!formula && !allowedDice.length)) {
      return { state, result: { ok: false, error: "Roll request requires label, reason, and a formula or allowed dice." } };
    }
    if (allowedDice.some((die) => !DICE_TYPES.includes(die))) {
      return { state, result: { ok: false, error: "Roll request contains an unsupported die type." } };
    }
    if (!ROLL_KINDS.includes(rollKind)) {
      return { state, result: { ok: false, error: "Invalid roll kind." } };
    }
    if (formula) {
      try {
        parsedFormula = parseDiceFormula(formula);
      } catch (error) {
        return {
          state,
          result: {
            ok: false,
            error: error instanceof Error ? error.message : "Invalid dice formula.",
          },
        };
      }
    }
    if (parsedFormula && allowedDice.length) {
      const allowed = new Set(allowedDice);
      const invalidTerm = parsedFormula.terms.find((term) => !allowed.has(`d${term.sides}` as DiceType));
      if (invalidTerm) {
        return { state, result: { ok: false, error: "Roll formula uses a die that is not present in allowedDice." } };
      }
    }
    if (rollKind === "duality") {
      if (!parsedFormula) {
        return { state, result: { ok: false, error: "Duality rolls require a formula with exactly two positive d12 dice." } };
      }
      const positiveD12Count = parsedFormula.terms
        .filter((term) => term.sign > 0 && term.sides === 12)
        .reduce((total, term) => total + term.count, 0);
      if (positiveD12Count !== 2) {
        return { state, result: { ok: false, error: "Duality rolls require exactly two positive d12 dice for Hope and Fear." } };
      }
    }
    if (targetArg !== undefined && !Number.isFinite(targetArg)) {
      return { state, result: { ok: false, error: "Invalid roll target." } };
    }
    if (dcArg !== undefined && !Number.isFinite(dcArg)) {
      return { state, result: { ok: false, error: "Invalid roll DC." } };
    }
    if (targetArg !== undefined && dcArg !== undefined && targetArg !== dcArg) {
      return { state, result: { ok: false, error: "Roll target and DC cannot disagree." } };
    }
    if (state.pendingRoll) {
      return {
        state,
        result: {
          ok: false,
          waitingForPlayerRoll: true,
          error: "A player roll is already pending and must be resolved first.",
          pendingRoll: state.pendingRoll,
        },
      };
    }
    const next = requestPlayerRoll(state, {
      label,
      reason,
      ...(parsedFormula ? { formula: parsedFormula.normalized } : {}),
      ...(allowedDice.length ? { allowedDice } : {}),
      ...(targetArg !== undefined || dcArg !== undefined ? { target: targetArg ?? dcArg } : {}),
      rollKind,
    });
    return {
      state: next,
      result: {
        ok: true,
        waitingForPlayerRoll: true,
        pendingRoll: next.pendingRoll,
      },
    };
  }

  if (name === "character_adjust_resource") {
    const resource = args.resource;
    const amount = Number(args.amount);
    if (!["hp", "hope", "stress", "armor"].includes(String(resource)) || !Number.isFinite(amount)) {
      return { state, result: { ok: false, error: "Invalid resource adjustment." } };
    }
    const next = executeCommand(
      state,
      { type: "adjust", resource: resource as "hp" | "hope" | "stress" | "armor", amount },
      "gm-ai",
    );
    return { state: next, result: { ok: true, character: next.character } };
  }

  if (name === "inventory_adjust") {
    const itemId = String(args.itemId || "");
    const amount = Number(args.amount);
    const item = state.inventory.find((entry) => entry.id === itemId);
    if (!item || !Number.isFinite(amount)) {
      return { state, result: { ok: false, error: "Unknown item or invalid amount." } };
    }
    const next = executeCommand(state, { type: "inventory", itemId, amount }, "gm-ai");
    return {
      state: next,
      result: { ok: true, item: next.inventory.find((entry) => entry.id === itemId) },
    };
  }

  if (name === "quest_add") {
    const title = String(args.title || "").trim();
    const stage = String(args.stage || "").trim();
    const deadlineMinutes = args.deadlineMinutes === undefined ? undefined : Number(args.deadlineMinutes);
    if (!title || !stage) {
      return { state, result: { ok: false, error: "Quest title and stage are required." } };
    }
    if (deadlineMinutes !== undefined && (!Number.isInteger(deadlineMinutes) || deadlineMinutes <= 0)) {
      return { state, result: { ok: false, error: "Quest deadline must be a positive whole number of minutes." } };
    }
    const questId = globalThis.crypto?.randomUUID?.() || `quest-${Math.random().toString(36).slice(2, 10)}`;
    const acceptedAtCampaignMinute = state.time.campaignMinute;
    const deadlineCampaignMinute = deadlineMinutes === undefined ? undefined : acceptedAtCampaignMinute + deadlineMinutes;
    const quest = {
      id: questId,
      title,
      status: "active" as const,
      stage,
      acceptedAtCampaignMinute,
      ...(deadlineCampaignMinute !== undefined ? { deadlineCampaignMinute } : {}),
    };
    let time = state.time;
    let calendarEvent: CampaignCalendarEvent | undefined;
    if (deadlineCampaignMinute !== undefined) {
      const existingIds = new Set(time.events.map((entry) => entry.id));
      time = addCalendarEvent(time, {
        title,
        startCampaignMinute: acceptedAtCampaignMinute,
        endCampaignMinute: deadlineCampaignMinute,
        kind: "quest",
        sourceId: questId,
        description: typeof args.deadlineDescription === "string" && args.deadlineDescription.trim()
          ? args.deadlineDescription.trim()
          : `Prazo da missão: ${stage}`,
      });
      calendarEvent = time.events.find((entry) => !existingIds.has(entry.id));
    }
    return {
      state: { ...state, time, quests: [...state.quests, quest] },
      result: { ok: true, quest, calendarEvent },
    };
  }

  if (name === "quest_set_status") {
    const questId = String(args.questId || "");
    const status = String(args.status || "");
    if (!state.quests.some((quest) => quest.id === questId) || !["active", "completed"].includes(status)) {
      return { state, result: { ok: false, error: "Unknown quest or invalid status." } };
    }
    let next = executeCommand(
      state,
      { type: "quest", questId, status: status as "active" | "completed" },
      "gm-ai",
    );
    const linkedEvent = next.time.events.find((entry) => entry.sourceId === questId);
    if (linkedEvent) {
      next = {
        ...next,
        time: updateCalendarEvent(next.time, linkedEvent.id, { completed: status === "completed" }),
      };
    }
    return { state: next, result: { ok: true, quest: next.quests.find((quest) => quest.id === questId) } };
  }

  if (name === "condition_set") {
    const condition = String(args.name || "").trim();
    const active = Boolean(args.active);
    if (!condition) return { state, result: { ok: false, error: "Condition name is required." } };
    const next = executeCommand(state, { type: "condition", name: condition, active }, "gm-ai");
    return { state: next, result: { ok: true, conditions: next.character.conditions } };
  }

  if (name === "advance_time") {
    const minutes = Number(args.minutes);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      return { state, result: { ok: false, error: "Time advance must be a positive whole number of minutes." } };
    }
    const before = state.time.campaignMinute;
    const time = advanceCampaignTime(state.time, minutes);
    const reachedEvents = time.events.filter((event) => {
      if (event.completed) return false;
      const target = event.endCampaignMinute ?? event.startCampaignMinute;
      return target > before && target <= time.campaignMinute;
    });
    return {
      state: { ...state, time },
      result: {
        ok: true,
        campaignMinute: time.campaignMinute,
        elapsedMinutes: minutes,
        reachedEvents,
      },
    };
  }

  if (name === "set_weather") {
    const condition = String(args.condition || "") as WeatherCondition;
    const label = String(args.label || "").trim();
    if (!WEATHER_CONDITIONS.includes(condition) || !label) {
      return { state, result: { ok: false, error: "Invalid weather condition or label." } };
    }
    if (args.intensity !== undefined && !WEATHER_INTENSITIES.includes(String(args.intensity) as typeof WEATHER_INTENSITIES[number])) {
      return { state, result: { ok: false, error: "Invalid weather intensity." } };
    }
    const temperatureC = args.temperatureC === undefined ? undefined : Number(args.temperatureC);
    if (temperatureC !== undefined && !Number.isFinite(temperatureC)) {
      return { state, result: { ok: false, error: "Invalid weather temperature." } };
    }
    const time = setCampaignWeather(state.time, {
      condition,
      label,
      ...(typeof args.description === "string" ? { description: args.description.trim() } : {}),
      ...(temperatureC !== undefined ? { temperatureC } : {}),
      ...(args.intensity !== undefined ? { intensity: args.intensity as "light" | "moderate" | "heavy" } : {}),
    });
    return { state: { ...state, time }, result: { ok: true, weather: time.weather } };
  }

  if (name === "calendar_event_add") {
    const title = String(args.title || "").trim();
    const explicitStart = args.startCampaignMinute === undefined ? undefined : Number(args.startCampaignMinute);
    const startsInMinutes = args.startsInMinutes === undefined ? 0 : Number(args.startsInMinutes);
    const durationMinutes = args.durationMinutes === undefined ? undefined : Number(args.durationMinutes);
    const startCampaignMinute = explicitStart === undefined ? state.time.campaignMinute + startsInMinutes : explicitStart;
    const explicitEnd = args.endCampaignMinute === undefined ? undefined : Number(args.endCampaignMinute);
    const endCampaignMinute = explicitEnd === undefined && durationMinutes !== undefined
      ? startCampaignMinute + durationMinutes
      : explicitEnd;
    const kind = args.kind === undefined ? undefined : String(args.kind) as CalendarEventKind;
    if (!title || !Number.isInteger(startCampaignMinute) || startCampaignMinute < 0 || !Number.isInteger(startsInMinutes) || startsInMinutes < 0) {
      return { state, result: { ok: false, error: "Calendar event requires a title and valid start campaign minute." } };
    }
    if (durationMinutes !== undefined && (!Number.isInteger(durationMinutes) || durationMinutes <= 0)) {
      return { state, result: { ok: false, error: "Invalid calendar event duration." } };
    }
    if (endCampaignMinute !== undefined && (!Number.isInteger(endCampaignMinute) || endCampaignMinute < 0)) {
      return { state, result: { ok: false, error: "Invalid calendar event end campaign minute." } };
    }
    if (kind !== undefined && !CALENDAR_EVENT_KINDS.includes(kind)) {
      return { state, result: { ok: false, error: "Invalid calendar event kind." } };
    }
    if (args.completed !== undefined && typeof args.completed !== "boolean") {
      return { state, result: { ok: false, error: "Invalid calendar event completion flag." } };
    }
    const event: Omit<CampaignCalendarEvent, "id"> = {
      title,
      startCampaignMinute,
      ...(endCampaignMinute !== undefined ? { endCampaignMinute } : {}),
      ...(kind !== undefined ? { kind } : {}),
      ...(typeof args.sourceId === "string" && args.sourceId.trim() ? { sourceId: args.sourceId.trim() } : {}),
      ...(typeof args.description === "string" ? { description: args.description.trim() } : {}),
      ...(typeof args.completed === "boolean" ? { completed: args.completed } : {}),
    };
    try {
      const existingIds = new Set(state.time.events.map((entry) => entry.id));
      const time = addCalendarEvent(state.time, event);
      const added = time.events.find((entry) => !existingIds.has(entry.id));
      return { state: { ...state, time }, result: { ok: true, event: added } };
    } catch (error) {
      return { state, result: { ok: false, error: error instanceof Error ? error.message : "Invalid calendar event." } };
    }
  }

  if (name === "calendar_event_update") {
    const eventId = String(args.eventId || "").trim();
    if (!eventId || !state.time.events.some((entry) => entry.id === eventId)) {
      return { state, result: { ok: false, error: "Unknown calendar event." } };
    }
    const changes: Partial<Omit<CampaignCalendarEvent, "id">> = {};
    if (args.title !== undefined) {
      const title = String(args.title).trim();
      if (!title) return { state, result: { ok: false, error: "Calendar event title cannot be empty." } };
      changes.title = title;
    }
    if (args.startCampaignMinute !== undefined) {
      const startCampaignMinute = Number(args.startCampaignMinute);
      if (!Number.isInteger(startCampaignMinute) || startCampaignMinute < 0) {
        return { state, result: { ok: false, error: "Invalid calendar event start campaign minute." } };
      }
      changes.startCampaignMinute = startCampaignMinute;
    }
    if (args.endCampaignMinute !== undefined) {
      const endCampaignMinute = Number(args.endCampaignMinute);
      if (!Number.isInteger(endCampaignMinute) || endCampaignMinute < 0) {
        return { state, result: { ok: false, error: "Invalid calendar event end campaign minute." } };
      }
      changes.endCampaignMinute = endCampaignMinute;
    }
    if (args.kind !== undefined) {
      const kind = String(args.kind) as CalendarEventKind;
      if (!CALENDAR_EVENT_KINDS.includes(kind)) {
        return { state, result: { ok: false, error: "Invalid calendar event kind." } };
      }
      changes.kind = kind;
    }
    if (args.sourceId !== undefined) {
      changes.sourceId = String(args.sourceId).trim() || undefined;
    }
    if (args.description !== undefined) {
      changes.description = String(args.description).trim();
    }
    if (args.completed !== undefined) {
      if (typeof args.completed !== "boolean") {
        return { state, result: { ok: false, error: "Invalid calendar event completion flag." } };
      }
      changes.completed = args.completed;
    }
    if (!Object.keys(changes).length) {
      return { state, result: { ok: false, error: "Calendar event update requires at least one change." } };
    }
    try {
      const time = updateCalendarEvent(state.time, eventId, changes);
      return {
        state: { ...state, time },
        result: { ok: true, event: time.events.find((entry) => entry.id === eventId) },
      };
    } catch (error) {
      return { state, result: { ok: false, error: error instanceof Error ? error.message : "Invalid calendar event update." } };
    }
  }

  if (name === "calendar_event_remove") {
    const eventId = String(args.eventId || "").trim();
    if (!eventId || !state.time.events.some((entry) => entry.id === eventId)) {
      return { state, result: { ok: false, error: "Unknown calendar event." } };
    }
    const time = removeCalendarEvent(state.time, eventId);
    return { state: { ...state, time }, result: { ok: true, eventId } };
  }

  if (name === "timeline_entry_add") {
    const title = String(args.title || "").trim();
    const description = String(args.description || "").trim();
    const kind = String(args.kind || "other") as TimelineKind;
    const importance = args.importance === "major" ? "major" as const : "normal" as const;
    const visibility = args.visibility === "hidden" ? "hidden" as const : "public" as const;
    const hasWorldDate = args.year !== undefined || args.monthIndex !== undefined || args.day !== undefined;
    const currentDate = deriveCampaignDateTime(state.time);
    let worldDate: TimelineEntry["worldDate"] | undefined;
    if (hasWorldDate) {
      const monthIndex = Number.isInteger(Number(args.monthIndex))
        ? Math.min(state.time.calendar.months.length - 1, Math.max(0, Number(args.monthIndex)))
        : currentDate.monthIndex;
      const month = state.time.calendar.months[monthIndex];
      worldDate = {
        year: Number.isInteger(Number(args.year)) ? Number(args.year) : currentDate.year,
        monthIndex,
        day: Number.isInteger(Number(args.day)) ? Math.min(month.days, Math.max(1, Number(args.day))) : currentDate.day,
        hour: Number.isInteger(Number(args.hour)) ? Math.min(23, Math.max(0, Number(args.hour))) : 12,
        minute: Number.isInteger(Number(args.minute)) ? Math.min(59, Math.max(0, Number(args.minute))) : 0,
      };
      const currentOrdinal = worldDateOrdinalMinute(state.time.calendar, {
        year: currentDate.year,
        monthIndex: currentDate.monthIndex,
        day: currentDate.day,
        hour: currentDate.hour,
        minute: currentDate.minute,
      });
      if (worldDateOrdinalMinute(state.time.calendar, worldDate) > currentOrdinal) {
        return { state, result: { ok: false, error: "Timeline entries cannot use a future world date. Future events belong to the calendar." } };
      }
    }
    const minute = args.campaignMinute === undefined
      ? state.time.campaignMinute
      : Number(args.campaignMinute);
    if (!title || !description || !TIMELINE_KINDS.includes(kind)) {
      return { state, result: { ok: false, error: "Invalid timeline entry." } };
    }
    if (title.length > 100 || description.length > 420) {
      return { state, result: { ok: false, error: "Timeline entries must be atomic: use a title up to 100 characters and a description up to 420 characters. Split multiple facts into separate entries." } };
    }
    if (!Number.isInteger(minute) || minute < 0 || minute > state.time.campaignMinute) {
      return { state, result: { ok: false, error: "Timeline entries must use the current or a past campaign minute. Future events belong to the calendar." } };
    }
    const tags = Array.from(new Set(
      (Array.isArray(args.tags) ? args.tags : [])
        .map((value) => String(value).trim())
        .filter(Boolean)
        .slice(0, 8),
    ));
    const image = typeof args.image === "string" && args.image.trim() ? args.image.trim() : undefined;
    const signature = normalizeTimelineText(title + " " + description);
    const duplicate = (state.timeline ?? []).find((entry) => {
      const sameText = normalizeTimelineText(entry.title + " " + entry.description) === signature;
      if (!sameText) return false;
      if (worldDate && entry.worldDate) {
        return entry.worldDate.year === worldDate.year
          && entry.worldDate.monthIndex === worldDate.monthIndex
          && entry.worldDate.day === worldDate.day
          && entry.worldDate.hour === worldDate.hour
          && entry.worldDate.minute === worldDate.minute;
      }
      return !worldDate && !entry.worldDate && entry.campaignMinute === minute;
    });
    if (duplicate) {
      return {
        state,
        result: { ok: true, duplicate: true, entry: duplicate, dateLabel: formatTimelineEntryDate(state.time, duplicate, true) },
      };
    }
    const entry = {
      id: globalThis.crypto?.randomUUID?.() || `timeline-${Math.random().toString(36).slice(2, 10)}`,
      title,
      description,
      campaignMinute: minute,
      ...(worldDate ? { worldDate } : {}),
      createdAt: new Date().toISOString(),
      kind,
      tags,
      visibility,
      importance,
      ...(image ? { image } : {}),
    };
    const timeline = [...(state.timeline ?? []), entry]
      .sort((a, b) => timelineEntrySortValue(state.time, a) - timelineEntrySortValue(state.time, b) || Date.parse(a.createdAt) - Date.parse(b.createdAt));
    return {
      state: { ...state, timeline },
      result: { ok: true, entry, dateLabel: formatTimelineEntryDate(state.time, entry, true) },
    };
  }

  if (name === "timeline_entry_set_visibility") {
    const entryId = String(args.entryId || "").trim();
    const visibility = String(args.visibility || "");
    if (!entryId || !["public", "hidden"].includes(visibility)) {
      return { state, result: { ok: false, error: "Invalid timeline visibility update." } };
    }
    const current = (state.timeline ?? []).find((entry) => entry.id === entryId);
    if (!current) return { state, result: { ok: false, error: "Unknown timeline entry." } };
    if (current.visibility === visibility) {
      return { state, result: { ok: true, unchanged: true, entry: current } };
    }
    const timeline = (state.timeline ?? []).map((entry) =>
      entry.id === entryId ? { ...entry, visibility: visibility as "public" | "hidden" } : entry,
    );
    return { state: { ...state, timeline }, result: { ok: true, entry: timeline.find((entry) => entry.id === entryId) } };
  }

  if (name === "memory_record") {
    const kind = String(args.kind || "");
    const text = String(args.text || "").trim();
    if (!["fact", "event", "secret", "visual"].includes(kind) || !text) {
      return { state, result: { ok: false, error: "Invalid memory." } };
    }
    const normalizedMemory = normalizeTimelineText(text);
    const existingMemory = state.memories.find((memory) =>
      memory.kind === kind && normalizeTimelineText(memory.text) === normalizedMemory
    );
    if (existingMemory) {
      return { state, result: { ok: true, duplicate: true, memory: existingMemory } };
    }
    const next = executeCommand(
      state,
      { type: "memory", kind: kind as "fact" | "event" | "secret" | "visual", text },
      "gm-ai",
    );
    return { state: next, result: { ok: true, memory: next.memories[0] } };
  }

  if (name === "memory_search") {
    const query = String(args.query || "").trim().toLocaleLowerCase("pt-BR");
    const limit = Math.max(1, Math.min(20, Number(args.limit) || 8));
    const words = query.split(/\s+/).filter((word) => word.length > 2);
    const matches = state.memories
      .map((memory) => {
        const haystack = memory.text.toLocaleLowerCase("pt-BR");
        const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
        return { memory, score };
      })
      .filter((entry) => entry.score > 0 || !words.length)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => entry.memory);
    return { state, result: { ok: true, memories: matches } };
  }

  return { state, result: { ok: false, error: `Unknown tool: ${name}` } };
}

export function extractNarration(response: { output?: unknown[]; output_text?: unknown }) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }
  const output = Array.isArray(response.output) ? response.output : [];
  const parts: string[] = [];
  for (const item of output as Array<Record<string, unknown>>) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content as Array<Record<string, unknown>>) {
      if (content.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      } else if (typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

export function extractRefusal(response: { output?: unknown[] }) {
  const output = Array.isArray(response.output) ? response.output : [];
  const parts: string[] = [];
  for (const item of output as Array<Record<string, unknown>>) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content as Array<Record<string, unknown>>) {
      if (content.type === "refusal" && typeof content.refusal === "string") {
        parts.push(content.refusal);
      }
    }
  }
  return parts.join("\n").trim();
}
