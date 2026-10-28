import {
  deriveCampaignDateTime,
  type CampaignCalendarDefinition,
  type CampaignDateInput,
  type CampaignTimeState,
} from "@/lib/campaignTime";
import type { GameState, TimelineEntry, TimelineKind } from "@/lib/game";

export const TIMELINE_SCHEMA_VERSION = 2;

const TIMELINE_KINDS: TimelineKind[] = [
  "discovery",
  "quest",
  "combat",
  "travel",
  "relationship",
  "world",
  "milestone",
  "other",
];

type TimelineDraft = {
  title?: unknown;
  description?: unknown;
  kind?: unknown;
  tags?: unknown;
  importance?: unknown;
  visibility?: unknown;
  year?: unknown;
  monthIndex?: unknown;
  month?: unknown;
  day?: unknown;
  hour?: unknown;
  minute?: unknown;
};

function normalizeJsonText(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function normalizeText(value: unknown, maxLength: number) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, Math.max(1, maxLength - 1)).trimEnd() + "…";
}

function normalizedSignature(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function daysPerYear(calendar: CampaignCalendarDefinition) {
  return calendar.months.reduce((total, month) => total + month.days, 0);
}

export function worldDateOrdinalMinute(calendar: CampaignCalendarDefinition, input: CampaignDateInput) {
  const monthIndex = clampInteger(input.monthIndex, 0, Math.max(0, calendar.months.length - 1), 0);
  const month = calendar.months[monthIndex];
  const day = clampInteger(input.day, 1, month?.days || 1, 1);
  const hour = clampInteger(input.hour, 0, 23, 0);
  const minute = clampInteger(input.minute, 0, 59, 0);
  const daysBeforeMonth = calendar.months.slice(0, monthIndex).reduce((total, entry) => total + entry.days, 0);
  // This is deliberately independent of epochYear so the timeline can represent
  // old historical years even when they predate the campaign clock's generated epoch.
  return ((Math.trunc(input.year) * daysPerYear(calendar) + daysBeforeMonth + day - 1) * 1440)
    + hour * 60
    + minute;
}

function currentWorldDate(time: CampaignTimeState): Required<CampaignDateInput> {
  const current = deriveCampaignDateTime(time);
  return {
    year: current.year,
    monthIndex: current.monthIndex,
    day: current.day,
    hour: current.hour,
    minute: current.minute,
  };
}

export function timelineEntryWorldDate(time: CampaignTimeState, entry: TimelineEntry): Required<CampaignDateInput> {
  if (entry.worldDate) return entry.worldDate;
  const date = deriveCampaignDateTime(time, entry.campaignMinute);
  return {
    year: date.year,
    monthIndex: date.monthIndex,
    day: date.day,
    hour: date.hour,
    minute: date.minute,
  };
}

export function timelineEntrySortValue(time: CampaignTimeState, entry: TimelineEntry) {
  return worldDateOrdinalMinute(time.calendar, timelineEntryWorldDate(time, entry));
}

export function timelineElapsedMinutes(time: CampaignTimeState, entry: TimelineEntry) {
  const current = worldDateOrdinalMinute(time.calendar, currentWorldDate(time));
  return Math.max(0, current - timelineEntrySortValue(time, entry));
}

export function formatTimelineEntryDate(time: CampaignTimeState, entry: TimelineEntry, includeWeekday = true) {
  const date = timelineEntryWorldDate(time, entry);
  const month = time.calendar.months[date.monthIndex] || time.calendar.months[0];
  const yearDays = daysPerYear(time.calendar);
  const daysBeforeMonth = time.calendar.months.slice(0, date.monthIndex).reduce((total, item) => total + item.days, 0);
  const absoluteDay = (date.year - time.calendar.epochYear) * yearDays + daysBeforeMonth + date.day - 1;
  const weekdayIndex = ((absoluteDay % time.calendar.weekdays.length) + time.calendar.weekdays.length) % time.calendar.weekdays.length;
  const weekday = includeWeekday ? `${time.calendar.weekdays[weekdayIndex]?.name || ""}, ` : "";
  return `${weekday}${date.day} de ${month?.name || "?"}, ${date.year} · ${String(date.hour).padStart(2, "0")}:${String(date.minute).padStart(2, "0")}`;
}

export type ManualTimelineEntryInput = {
  title: string;
  description: string;
  kind: TimelineKind;
  tags: string[];
  importance: "normal" | "major";
  year: number;
  monthIndex: number;
  day: number;
  hour: number;
  minute: number;
};

export function upsertManualTimelineEntry(
  time: CampaignTimeState,
  entries: TimelineEntry[],
  input: ManualTimelineEntryInput,
  createdAt = new Date().toISOString(),
  entryId?: string,
) {
  const title = normalizeText(input.title, 90);
  const description = normalizeText(input.description, 360);
  if (!title || !description) throw new Error("Título e descrição são obrigatórios.");
  if (!TIMELINE_KINDS.includes(input.kind)) throw new Error("Tipo de acontecimento inválido.");

  const current = currentWorldDate(time);
  const monthIndex = clampInteger(input.monthIndex, 0, Math.max(0, time.calendar.months.length - 1), current.monthIndex);
  const month = time.calendar.months[monthIndex];
  const worldDate = {
    year: Math.trunc(Number(input.year)),
    monthIndex,
    day: clampInteger(input.day, 1, month?.days || 1, current.day),
    hour: clampInteger(input.hour, 0, 23, current.hour),
    minute: clampInteger(input.minute, 0, 59, current.minute),
  };
  if (!Number.isFinite(worldDate.year)) throw new Error("Ano inválido.");

  const currentOrdinal = worldDateOrdinalMinute(time.calendar, current);
  const worldOrdinal = worldDateOrdinalMinute(time.calendar, worldDate);
  if (worldOrdinal > currentOrdinal) throw new Error("A data da timeline não pode ser futura.");

  const existing = entryId ? entries.find((entry) => entry.id === entryId) : undefined;
  if (entryId && !existing) throw new Error("Acontecimento da timeline não encontrado.");
  const tags = Array.from(new Set(input.tags.map((tag) => normalizeText(tag, 32)).filter(Boolean))).slice(0, 8);
  const campaignMinute = Math.min(
    time.campaignMinute,
    Math.max(0, time.campaignMinute - (currentOrdinal - worldOrdinal)),
  );
  const entry: TimelineEntry = {
    id: existing?.id || globalThis.crypto?.randomUUID?.() || `timeline-player-${Math.random().toString(36).slice(2, 10)}`,
    title,
    description,
    campaignMinute,
    worldDate,
    createdAt: existing?.createdAt || createdAt,
    kind: input.kind,
    tags,
    visibility: "public",
    importance: input.importance,
    ...(existing?.image ? { image: existing.image } : {}),
  };
  const timeline = [...entries.filter((item) => item.id !== entry.id), entry]
    .sort((a, b) => timelineEntrySortValue(time, a) - timelineEntrySortValue(time, b) || Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return { timeline, entry };
}

function sourceMemories(state: GameState) {
  return state.memories
    .filter((memory) => memory.kind === "event" || memory.kind === "fact")
    .map((memory) => memory.text.trim())
    .filter(Boolean)
    .slice(0, 30);
}

export function buildTimelineSynthesisPrompt(state: GameState) {
  const current = currentWorldDate(state.time);
  const calendar = state.time.calendar;
  const monthDescription = calendar.months
    .map((month, index) => `${index}: ${month.name} (${month.days} dias)`)
    .join("; ");
  const memories = sourceMemories(state);

  return [
    "MONTE A LINHA DO TEMPO HISTÓRICA DA CAMPANHA.",
    "",
    `Data em que a campanha começa: ${current.day}/${current.monthIndex}/${current.year} ${String(current.hour).padStart(2, "0")}:${String(current.minute).padStart(2, "0")}.`,
    `Calendário: ${calendar.name}. Meses (monthIndex é zero-based): ${monthDescription}.`,
    "",
    `Gancho da aventura: ${state.campaign.adventureHook?.trim() || "não informado"}`,
    `História do personagem: ${state.character.daggerheart?.history?.trim() || "não informada"}`,
    memories.length ? `Memórias públicas já conhecidas:\n- ${memories.join("\n- ")}` : "Memórias públicas já conhecidas: nenhuma.",
    "",
    "Retorne somente JSON válido no formato {\"entries\":[...]}. Cada entry deve ter: title, description, kind, year, monthIndex, day, hour, minute, tags, importance.",
    "Regras obrigatórias:",
    "- Cada entry representa UM único fato histórico ou acontecimento. Se uma frase contiver dois acontecimentos, crie duas entries, mesmo que tenham a mesma data.",
    "- Não copie o gancho, a história ou uma memória inteira. Reescreva de forma curta e factual: título curto e descrição com no máximo duas frases.",
    "- Extraia acontecimentos concretos: fundações, nascimentos, encontros, perdas, descobertas, vitórias, mudanças de relação, início/conclusão de treinamento, missões e a situação que inicia a campanha.",
    "- Fatos de mundo que não são um instante único também podem entrar separados (por exemplo, 'a academia tornou-se famosa'); atribua a data plausível em que esse fato passou a ser verdadeiro ou relevante.",
    "- Ignore regras gerais, estatísticas, listas de equipamento e descrição de mecânicas quando não forem acontecimentos históricos.",
    "- Se o texto informar uma data ou intervalo relativo, respeite-o. Se não informar, ESTIPULE uma data plausível e consistente com a ordem dos fatos.",
    "- Você pode estipular anos muito anteriores ao epochYear do calendário; a timeline suporta anos históricos anteriores ao relógio da campanha.",
    "- Nunca coloque um evento depois da data de início da campanha.",
    "- Eventos diferentes podem ter exatamente a mesma data e devem continuar em entries separadas.",
    "- Use kind somente entre discovery, quest, combat, travel, relationship, world, milestone, other.",
    "- Use importance major apenas para marcos realmente importantes.",
    "- Inclua somente fatos conhecidos pelo jogador. Segredos não revelados não entram.",
    "- Produza de 2 a 16 entries quando houver material suficiente; prefira menos entradas boas a preencher por preencher.",
  ].join("\n");
}

function resolveMonthIndex(calendar: CampaignCalendarDefinition, draft: TimelineDraft, fallback: number) {
  if (Number.isFinite(Number(draft.monthIndex))) {
    return clampInteger(draft.monthIndex, 0, Math.max(0, calendar.months.length - 1), fallback);
  }
  const monthName = String(draft.month || "").trim().toLocaleLowerCase("pt-BR");
  if (monthName) {
    const index = calendar.months.findIndex((month) => month.name.toLocaleLowerCase("pt-BR") === monthName);
    if (index >= 0) return index;
  }
  return fallback;
}

export function parseTimelineSynthesis(text: string, time: CampaignTimeState, createdAt = new Date().toISOString()) {
  const cleaned = normalizeJsonText(text);
  const candidates = [cleaned];
  const objectStart = cleaned.indexOf("{");
  const objectEnd = cleaned.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) candidates.push(cleaned.slice(objectStart, objectEnd + 1));

  let drafts: TimelineDraft[] = [];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const array = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { entries?: unknown[] }).entries)
          ? (parsed as { entries: unknown[] }).entries
          : [];
      drafts = array.filter((item): item is TimelineDraft => Boolean(item && typeof item === "object"));
      if (drafts.length) break;
    } catch {}
  }
  if (!drafts.length) return [] as TimelineEntry[];

  const current = currentWorldDate(time);
  const currentOrdinal = worldDateOrdinalMinute(time.calendar, current);
  const seen = new Set<string>();
  const entries: TimelineEntry[] = [];

  for (const [index, draft] of drafts.slice(0, 16).entries()) {
    const title = normalizeText(draft.title, 90);
    const description = normalizeText(draft.description, 360);
    if (!title || !description) continue;
    const kindCandidate = String(draft.kind || "other") as TimelineKind;
    const kind = TIMELINE_KINDS.includes(kindCandidate) ? kindCandidate : "other";
    const monthIndex = resolveMonthIndex(time.calendar, draft, current.monthIndex);
    const month = time.calendar.months[monthIndex];
    const worldDate = {
      year: clampInteger(draft.year, -9999, 99999, current.year),
      monthIndex,
      day: clampInteger(draft.day, 1, month?.days || 1, current.day),
      hour: clampInteger(draft.hour, 0, 23, 12),
      minute: clampInteger(draft.minute, 0, 59, 0),
    };
    if (worldDateOrdinalMinute(time.calendar, worldDate) > currentOrdinal) {
      Object.assign(worldDate, current);
    }
    const signature = normalizedSignature(`${title} ${description}`);
    const datedSignature = `${signature}|${worldDateOrdinalMinute(time.calendar, worldDate)}`;
    if (!signature || seen.has(datedSignature)) continue;
    seen.add(datedSignature);
    const tags = Array.from(new Set(
      (Array.isArray(draft.tags) ? draft.tags : [])
        .map((tag) => normalizeText(tag, 32))
        .filter(Boolean),
    )).slice(0, 6);
    const entry: TimelineEntry = {
      id: globalThis.crypto?.randomUUID?.() || `timeline-seed-${index}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      description,
      // campaignMinute remains for compatibility with existing state/tools. The
      // explicit worldDate is authoritative for historical entries.
      campaignMinute: Math.min(time.campaignMinute, Math.max(0, time.campaignMinute - (currentOrdinal - worldDateOrdinalMinute(time.calendar, worldDate)))),
      worldDate,
      createdAt,
      kind,
      tags,
      visibility: draft.visibility === "hidden" ? "hidden" : "public",
      importance: draft.importance === "major" ? "major" : "normal",
    };
    entries.push(entry);
  }

  return entries.sort((a, b) => timelineEntrySortValue(time, a) - timelineEntrySortValue(time, b) || Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function mergeTimelineEntries(time: CampaignTimeState, existing: TimelineEntry[], generated: TimelineEntry[]) {
  const signatures = new Set(existing.map((entry) =>
    `${normalizedSignature(`${entry.title} ${entry.description}`)}|${timelineEntrySortValue(time, entry)}`
  ));
  const merged = [...existing];
  for (const entry of generated) {
    const textSignature = normalizedSignature(`${entry.title} ${entry.description}`);
    const signature = `${textSignature}|${timelineEntrySortValue(time, entry)}`;
    if (!textSignature || signatures.has(signature)) continue;
    signatures.add(signature);
    merged.push(entry);
  }
  return merged.sort((a, b) => timelineEntrySortValue(time, a) - timelineEntrySortValue(time, b) || Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
