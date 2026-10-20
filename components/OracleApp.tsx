"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  buildContextPacket,
  createCampaignRestartSnapshot,
  executeCommand,
  GameState,
  initialState,
  Message,
  restartCampaignFromSnapshot,
  undoLatest,
} from "@/lib/game";
import {
  readCloudCredentialsForCampaign,
  removeCloudMetadataForCampaign,
  useCloudSync,
} from "@/hooks/useCloudSync";
import { useOracleBridge } from "@/hooks/useOracleBridge";
import { buildTurnInput, executeGmTool, extractNarration, extractRefusal, gmInstructions, responseTools } from "@/lib/gm";
import { buildSceneImagePrompt, buildSceneSnapshot, formatNarrationText, latestGmMessage } from "@/lib/scene";
import DaggerheartCompendium from "@/components/DaggerheartCompendium";
import NewCampaignWizard, { type NewCampaignResult } from "@/components/NewCampaignWizard";
import { CLASS_CONFIG, TRAIT_LABELS, TRAIT_ORDER } from "@/lib/characterCreation/daggerheart";
import { daggerheartCompendium, mechanicsSummary, type CompendiumEntry } from "@/lib/compendium/daggerheart";
import {
  campaignMinuteFromDate,
  createCampaignTimeState,
  deriveCampaignDateTime,
  formatCampaignDateTime,
  getMoonPhases,
  remainingDuration,
  setCampaignTime,
  setCampaignWeather,
  updateCalendarEvent,
  type CampaignCalendarEvent,
  type CampaignTimeState,
  type WeatherCondition,
} from "@/lib/campaignTime";
import {
  ACTIVE_CAMPAIGN_KEY,
  campaignActivityAt,
  type CampaignLibraryEntry,
  migrateLegacyCampaign,
  readCampaignLibrary,
  sortCampaigns,
  writeCampaignLibrary,
} from "@/lib/campaignLibrary";

type View = "session" | "character" | "world" | "memory";
type AppScreen = "home" | "campaigns" | "campaign" | "newCampaign" | "compendium" | "settings";
type CampaignAction = {
  type: "restart" | "delete";
  campaignId: string;
  step: 0 | 1;
} | null;

function Resource({
  label,
  value,
  max,
  kind,
  onAdjust,
}: {
  label: string;
  value: number;
  max: number;
  kind: "hp" | "hope" | "stress" | "armor";
  onAdjust: (kind: "hp" | "hope" | "stress" | "armor", amount: number) => void;
}) {
  return (
    <div className="resource">
      <div className="resourceTop"><span>{label}</span><strong>{value}<em>/{max}</em></strong></div>
      <div className="ticks">
        {Array.from({ length: max }).map((_, index) => <i className={index < value ? "filled" : ""} key={index} />)}
      </div>
      <div className="microActions">
        <button onClick={() => onAdjust(kind, -1)} aria-label={`Diminuir ${label}`}>−</button>
        <button onClick={() => onAdjust(kind, 1)} aria-label={`Aumentar ${label}`}>+</button>
      </div>
    </div>
  );
}

function AvatarSigil() {
  return (
    <div className="avatarSigil" aria-hidden="true">
      <span className="orbit orbitA" />
      <span className="orbit orbitB" />
      <span className="eye">◈</span>
    </div>
  );
}

function ActionInlineText({ text }: { text: string }) {
  const parts: Array<{ text: string; action: boolean }> = [];
  let cursor = 0;
  let action = false;

  while (cursor < text.length) {
    const marker = text.indexOf("**", cursor);
    if (marker < 0) {
      parts.push({ text: text.slice(cursor), action });
      break;
    }
    if (marker > cursor) parts.push({ text: text.slice(cursor, marker), action });
    action = !action;
    cursor = marker + 2;
  }

  return (
    <>
      {parts.map((part, index) => (
        <span className={part.action ? "characterActionText" : undefined} key={index}>{part.text}</span>
      ))}
    </>
  );
}

function MessageText({ text, actionSyntax = false }: { text: string; actionSyntax?: boolean }) {
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return (
    <div className="messageText">
      {blocks.map((block, index) => (
        <p key={index}>{actionSyntax ? <ActionInlineText text={block} /> : block}</p>
      ))}
    </div>
  );
}

function selectionOffsets(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return { start: root.textContent?.length || 0, end: root.textContent?.length || 0 };
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) {
    const end = root.textContent?.length || 0;
    return { start: end, end };
  }
  const startRange = range.cloneRange();
  startRange.selectNodeContents(root);
  startRange.setEnd(range.startContainer, range.startOffset);
  const endRange = range.cloneRange();
  endRange.selectNodeContents(root);
  endRange.setEnd(range.endContainer, range.endOffset);
  return { start: startRange.toString().length, end: endRange.toString().length };
}

function restoreCaret(root: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remaining = Math.max(0, offset);
  let node = walker.nextNode();
  while (node) {
    const size = node.textContent?.length || 0;
    if (remaining <= size) {
      const range = document.createRange();
      range.setStart(node, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= size;
    node = walker.nextNode();
  }
  const range = document.createRange();
  range.selectNodeContents(root);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function renderComposerMarkup(root: HTMLElement, value: string, caret?: number) {
  root.replaceChildren();
  let cursor = 0;
  let action = false;
  while (cursor < value.length) {
    const marker = value.indexOf("**", cursor);
    const chunkEnd = marker < 0 ? value.length : marker;
    if (chunkEnd > cursor) {
      const span = document.createElement("span");
      if (action) span.className = "composerActionText";
      span.textContent = value.slice(cursor, chunkEnd);
      root.append(span);
    }
    if (marker < 0) break;
    const delimiter = document.createElement("span");
    delimiter.className = "composerActionDelimiter";
    delimiter.textContent = "**";
    root.append(delimiter);
    action = !action;
    cursor = marker + 2;
  }
  if (!value) root.append(document.createTextNode(""));
  if (caret !== undefined) restoreCaret(root, caret);
}

function ActionComposer({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastDomValue = useRef("");
  const lastSelection = useRef({ start: 0, end: 0 });

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || value === lastDomValue.current) return;
    lastDomValue.current = value;
    renderComposerMarkup(editor, value);
  }, [value]);

  function syncFromDom() {
    const editor = editorRef.current;
    if (!editor) return;
    const offsets = selectionOffsets(editor);
    const caret = offsets.start;
    lastSelection.current = offsets;
    const next = editor.textContent || "";
    lastDomValue.current = next;
    renderComposerMarkup(editor, next, caret);
    onChange(next);
  }

  function insertActionMarkers() {
    const editor = editorRef.current;
    if (!editor || disabled) return;
    const savedSelection = lastSelection.current;
    editor.focus();
    const currentSelection = selectionOffsets(editor);
    const { start, end } = currentSelection.start === currentSelection.end && currentSelection.start === 0 && value.length
      ? savedSelection
      : currentSelection;
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + "**" + selected + "**" + value.slice(end);
    const nextCaret = selected ? end + 4 : start + 2;
    lastSelection.current = { start: nextCaret, end: nextCaret };
    lastDomValue.current = next;
    renderComposerMarkup(editor, next, nextCaret);
    onChange(next);
  }

  function onEditorKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.closest("form")?.requestSubmit();
    }
  }

  return (
    <>
      <button
        type="button"
        className="actionFormatButton"
        title="Marcar ação do personagem"
        aria-label="Marcar ação do personagem"
        onMouseDown={(event) => event.preventDefault()}
        onClick={insertActionMarkers}
        disabled={disabled}
      >*</button>
      <div
        ref={editorRef}
        className={"composerEditor " + (!value ? "empty" : "")}
        contentEditable={!disabled}
        role="textbox"
        aria-multiline="true"
        aria-label="Mensagem do jogador"
        data-placeholder={placeholder}
        onInput={syncFromDom}
        onKeyUp={() => {
          const editor = editorRef.current;
          if (editor) lastSelection.current = selectionOffsets(editor);
        }}
        onMouseUp={() => {
          const editor = editorRef.current;
          if (editor) lastSelection.current = selectionOffsets(editor);
        }}
        onBlur={() => {
          const editor = editorRef.current;
          if (editor) lastSelection.current = selectionOffsets(editor);
        }}
        onKeyDown={onEditorKeyDown}
        suppressContentEditableWarning
      />
    </>
  );
}

function findCompendiumEntry(id?: string, name?: string) {
  if (id) {
    const exact = daggerheartCompendium.entries.find((entry) => entry.id === id || entry.sourceId === id);
    if (exact) return exact;
  }
  if (!name) return undefined;
  const normalized = name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
  return daggerheartCompendium.entries.find((entry) =>
    entry.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR") === normalized
    || entry.originalName?.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR") === normalized
  );
}

function SheetExpandableCard({
  icon,
  title,
  subtitle,
  entry,
  description,
  badge,
}: {
  icon: string;
  title: string;
  subtitle: string;
  entry?: CompendiumEntry;
  description?: string;
  badge?: string;
}) {
  const body = description?.trim() || entry?.description?.trim() || "";
  const mechanics = entry ? mechanicsSummary(entry) : [];
  const canExpand = Boolean(body || mechanics.length);

  if (!canExpand) {
    return (
      <article className="miniCard">
        <b>{icon}</b>
        <div><h3>{title}</h3><p>{subtitle}</p></div>
        {badge && <strong>{badge}</strong>}
      </article>
    );
  }

  return (
    <details className="sheetExpandableCard">
      <summary>
        <b>{icon}</b>
        <div><h3>{title}</h3><p>{subtitle}</p></div>
        <span className={"sheetExpandHint " + (badge ? "badge" : "chevron")}>{badge || "⌄"}</span>
      </summary>
      <div className="sheetExpandableBody">
        {mechanics.length > 0 && (
          <div className="sheetMechanics">
            {mechanics.map((item, index) => (
              <span className={"mechanicChip " + item.kind} key={item.kind + item.label + index}>{item.label}</span>
            ))}
          </div>
        )}
        {body && <p>{body}</p>}
      </div>
    </details>
  );
}

function syncStateSummary(value: GameState) {
  const timestamps = [
    ...value.messages.map((entry) => entry.createdAt),
    ...value.events.map((entry) => entry.createdAt),
    ...value.memories.map((entry) => entry.createdAt),
  ]
    .map((entry) => Date.parse(entry))
    .filter((entry) => Number.isFinite(entry));
  const latest = timestamps.length ? new Date(Math.max(...timestamps)) : null;
  return {
    messages: value.messages.length,
    events: value.events.length,
    latestLabel: latest ? latest.toLocaleString("pt-BR") : "sem atividade registrada",
  };
}

const WEATHER_VISUAL: Record<WeatherCondition, { icon: string; label: string }> = {
  clear: { icon: "☀", label: "Ensolarado" },
  "partly-cloudy": { icon: "⛅", label: "Sol entre nuvens" },
  cloudy: { icon: "☁", label: "Nublado" },
  rain: { icon: "🌧", label: "Chovendo" },
  storm: { icon: "⛈", label: "Tempestade" },
  snow: { icon: "❄", label: "Nevando" },
  fog: { icon: "≋", label: "Neblina" },
  wind: { icon: "〰", label: "Ventando" },
  custom: { icon: "◈", label: "Clima incomum" },
};

function ensureCampaignTime(state: GameState, seed: string) {
  if ((state as GameState & { time?: CampaignTimeState }).time) return state;
  return {
    ...state,
    time: createCampaignTimeState({ seed }),
  };
}

function createRandomCampaignTime(seed: string) {
  const base = createCampaignTimeState({ seed });
  const monthIndex = Math.floor(Math.random() * base.calendar.months.length);
  const month = base.calendar.months[monthIndex];
  const year = base.calendar.epochYear + Math.floor(Math.random() * 24);
  const day = 1 + Math.floor(Math.random() * month.days);
  const hour = 7 + Math.floor(Math.random() * 13);
  const minute = [0, 10, 15, 20, 30, 40, 45, 50][Math.floor(Math.random() * 8)];
  let next = setCampaignTime(base, { year, monthIndex, day, hour, minute });
  const weatherOptions: Array<{ condition: WeatherCondition; label: string }> = [
    { condition: "clear", label: "Céu limpo" },
    { condition: "partly-cloudy", label: "Sol entre nuvens" },
    { condition: "cloudy", label: "Nublado" },
    { condition: "fog", label: "Neblina leve" },
    { condition: "wind", label: "Vento constante" },
  ];
  const initialWeather = weatherOptions[Math.floor(Math.random() * weatherOptions.length)];
  next = setCampaignWeather(next, initialWeather);
  return next;
}

function moonGlyph(phase: string) {
  return ({
    new: "●",
    "waxing-crescent": "◔",
    "first-quarter": "◐",
    "waxing-gibbous": "◕",
    full: "○",
    "waning-gibbous": "◕",
    "last-quarter": "◑",
    "waning-crescent": "◒",
  } as Record<string, string>)[phase] || "○";
}

function formatCampaignDuration(minutes: number) {
  const total = Math.max(0, Math.abs(Math.trunc(minutes)));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  const chunks = [];
  if (days) chunks.push(`${days}d`);
  if (hours) chunks.push(`${hours}h`);
  if (mins || !chunks.length) chunks.push(`${mins}min`);
  return chunks.join(" ");
}

function shiftCalendarMonth(time: CampaignTimeState, year: number, monthIndex: number, delta: number) {
  let nextYear = year;
  let nextMonth = monthIndex + delta;
  while (nextMonth < 0) {
    nextYear -= 1;
    nextMonth += time.calendar.months.length;
  }
  while (nextMonth >= time.calendar.months.length) {
    nextYear += 1;
    nextMonth -= time.calendar.months.length;
  }
  if (nextYear < time.calendar.epochYear) return { year: time.calendar.epochYear, monthIndex: 0 };
  return { year: nextYear, monthIndex: nextMonth };
}

function eventsForCalendarDay(time: CampaignTimeState, year: number, monthIndex: number, day: number) {
  const start = campaignMinuteFromDate(time.calendar, { year, monthIndex, day, hour: 0, minute: 0 });
  const end = start + 1440;
  return time.events.filter((event) => {
    const eventEnd = event.endCampaignMinute ?? event.startCampaignMinute;
    return event.startCampaignMinute < end && eventEnd >= start;
  });
}

function CampaignClockBar({ time, onOpenCalendar }: { time: CampaignTimeState; onOpenCalendar: () => void }) {
  const current = deriveCampaignDateTime(time);
  const weatherVisual = WEATHER_VISUAL[time.weather.condition] || WEATHER_VISUAL.custom;
  const skyIcon = current.period === "night" && time.weather.condition === "clear"
    ? "☾"
    : current.period === "night" && time.weather.condition === "partly-cloudy"
      ? "☾☁"
      : weatherVisual.icon;
  const timeLabel = `${String(current.hour).padStart(2, "0")}:${String(current.minute).padStart(2, "0")}`;
  return (
    <div className={`campaignClockBar period-${current.period} weather-${time.weather.condition}`}>
      <button className="campaignClockDate" onClick={onOpenCalendar} title="Abrir calendário da campanha">
        <span>
          <small>{time.calendar.name}</small>
          <strong>{current.day} de {current.month.name}</strong>
        </span>
        <b aria-hidden="true">▦</b>
      </button>
      <div className="campaignWeatherWindow" title={time.weather.description || time.weather.label}>
        <span className="campaignWeatherSky">
          <i>{skyIcon}</i>
        </span>
        <small>{time.weather.label || weatherVisual.label}</small>
      </div>
      <div className="campaignClockTime">
        <small>{current.weekday.name}</small>
        <strong>{timeLabel}</strong>
      </div>
    </div>
  );
}

function CalendarEventRow({ event, time }: { event: CampaignCalendarEvent; time: CampaignTimeState }) {
  const starts = formatCampaignDateTime(time, event.startCampaignMinute, { includeWeekday: false, includeTime: true });
  const ends = event.endCampaignMinute === undefined
    ? null
    : formatCampaignDateTime(time, event.endCampaignMinute, { includeWeekday: false, includeTime: true });
  const remaining = event.endCampaignMinute === undefined ? null : remainingDuration(time, event);
  return (
    <article className={`calendarEventRow kind-${event.kind || "custom"} ${event.completed ? "completed" : ""}`}>
      <b>{event.kind === "quest" ? "!" : event.kind === "effect" ? "✦" : event.kind === "appointment" ? "⌛" : "◉"}</b>
      <div>
        <small>{event.kind === "quest" ? "MISSÃO" : event.kind === "effect" ? "EFEITO" : event.kind === "appointment" ? "COMPROMISSO" : "EVENTO"}</small>
        <strong>{event.title}</strong>
        <p>{event.description || (ends ? `${starts} → ${ends}` : starts)}</p>
      </div>
      {remaining && !event.completed && <span className={remaining.expired ? "expired" : ""}>{remaining.expired ? "Prazo encerrado" : formatCampaignDuration(remaining.signedMinutes)}</span>}
    </article>
  );
}

function CampaignCalendarModal({ time, onClose }: { time: CampaignTimeState; onClose: () => void }) {
  const current = deriveCampaignDateTime(time);
  const [cursor, setCursor] = useState(() => ({ year: current.year, monthIndex: current.monthIndex }));
  const [selectedMinute, setSelectedMinute] = useState(time.campaignMinute);
  const month = time.calendar.months[cursor.monthIndex];
  const firstMinute = campaignMinuteFromDate(time.calendar, { year: cursor.year, monthIndex: cursor.monthIndex, day: 1 });
  const firstWeekday = deriveCampaignDateTime(time.calendar, firstMinute).weekdayIndex;
  const selectedDate = deriveCampaignDateTime(time, selectedMinute);
  const selectedEvents = eventsForCalendarDay(time, selectedDate.year, selectedDate.monthIndex, selectedDate.day);
  const selectedMoons = getMoonPhases(time, selectedMinute);
  const upcoming = time.events
    .filter((event) => !event.completed && (event.endCampaignMinute ?? event.startCampaignMinute) >= time.campaignMinute)
    .sort((a, b) => (a.endCampaignMinute ?? a.startCampaignMinute) - (b.endCampaignMinute ?? b.startCampaignMinute))
    .slice(0, 6);
  const calendarColumns = { gridTemplateColumns: `repeat(${time.calendar.weekdays.length}, minmax(0, 1fr))` };

  return (
    <div className="modalBackdrop calendarBackdrop" onClick={onClose}>
      <section className="campaignCalendarModal" onClick={(event) => event.stopPropagation()}>
        <header className="campaignCalendarHeader">
          <div>
            <small>CALENDÁRIO DA CAMPANHA</small>
            <h2>{time.calendar.name}</h2>
            <p>{time.calendar.weekdays.length} dias por semana · {time.calendar.months.length} meses por ano · {time.calendar.moons.length} {time.calendar.moons.length === 1 ? "lua" : "luas"}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar calendário">×</button>
        </header>

        <div className="campaignCalendarBody">
          <section className="calendarMonthPanel">
            <div className="calendarMonthNav">
              <button onClick={() => setCursor((value) => shiftCalendarMonth(time, value.year, value.monthIndex, -1))}>‹</button>
              <div><small>ANO {cursor.year}</small><strong>{month.name}</strong><span>{month.days} dias</span></div>
              <button onClick={() => setCursor((value) => shiftCalendarMonth(time, value.year, value.monthIndex, 1))}>›</button>
            </div>
            <div className="calendarWeekdays" style={calendarColumns}>
              {time.calendar.weekdays.map((weekday) => <span key={weekday.id}>{weekday.name.slice(0, 3)}</span>)}
            </div>
            <div className="calendarDays" style={calendarColumns}>
              {Array.from({ length: firstWeekday }).map((_, index) => <span className="calendarDayBlank" key={`blank-${index}`} />)}
              {Array.from({ length: month.days }, (_, index) => index + 1).map((day) => {
                const minute = campaignMinuteFromDate(time.calendar, { year: cursor.year, monthIndex: cursor.monthIndex, day });
                const dayEvents = eventsForCalendarDay(time, cursor.year, cursor.monthIndex, day);
                const isToday = cursor.year === current.year && cursor.monthIndex === current.monthIndex && day === current.day;
                const isSelected = cursor.year === selectedDate.year && cursor.monthIndex === selectedDate.monthIndex && day === selectedDate.day;
                const hasDeadline = dayEvents.some((event) => event.endCampaignMinute !== undefined && deriveCampaignDateTime(time, event.endCampaignMinute).absoluteDay === deriveCampaignDateTime(time, minute).absoluteDay);
                return (
                  <button
                    className={`calendarDay ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${dayEvents.length ? "hasEvents" : ""}`}
                    onClick={() => setSelectedMinute(minute)}
                    key={day}
                  >
                    <span>{day}</span>
                    {dayEvents.length > 0 && <i>{hasDeadline ? "!" : "•"}</i>}
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="calendarDetailPanel">
            <div className="calendarSelectedDate">
              <small>{selectedDate.weekday.name.toUpperCase()}</small>
              <h3>{selectedDate.day} de {selectedDate.month.name}</h3>
              <span>Ano {selectedDate.year}</span>
            </div>

            <div className="calendarMoonList">
              <small>CICLO {selectedMoons.length === 1 ? "DA LUA" : "DAS LUAS"}</small>
              {selectedMoons.map((moon) => (
                <div className="calendarMoon" key={moon.moon.id}>
                  <b>{moonGlyph(moon.phase)}</b>
                  <span><strong>{moon.moon.name}</strong><small>{moon.label} · {Math.round(moon.illumination * 100)}%</small></span>
                </div>
              ))}
            </div>

            <div className="calendarDayEvents">
              <div className="calendarDetailTitle"><small>EVENTOS DESTE DIA</small><span>{selectedEvents.length}</span></div>
              {selectedEvents.length ? selectedEvents.map((event) => <CalendarEventRow event={event} time={time} key={event.id} />) : <p>Nada marcado para este dia.</p>}
            </div>

            <div className="calendarUpcoming">
              <div className="calendarDetailTitle"><small>PRÓXIMOS PRAZOS</small><span>{upcoming.length}</span></div>
              {upcoming.length ? upcoming.map((event) => <CalendarEventRow event={event} time={time} key={event.id} />) : <p>Nenhum prazo futuro registrado.</p>}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

export default function OracleApp() {
  const [state, setState] = useState<GameState>(initialState);
  const [screen, setScreen] = useState<AppScreen>("home");
  const [view, setView] = useState<View>("session");
  const [input, setInput] = useState("");
  const [ready, setReady] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignLibraryEntry[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const campaignsRef = useRef<CampaignLibraryEntry[]>([]);
  const [showConnect, setShowConnect] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [pairInput, setPairInput] = useState("");
  const [syncNote, setSyncNote] = useState("");
  const [gmBusy, setGmBusy] = useState(false);
  const [gmError, setGmError] = useState("");
  const [imageMessageId, setImageMessageId] = useState<string | null>(null);
  const [imageNote, setImageNote] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [campaignAction, setCampaignAction] = useState<CampaignAction>(null);
  const [campaignActionError, setCampaignActionError] = useState("");

  useEffect(() => {
    let savedCampaigns = readCampaignLibrary();
    if (!savedCampaigns.length) {
      const migrated = migrateLegacyCampaign();
      if (migrated) savedCampaigns = [migrated];
    }
    const normalizedCampaigns = savedCampaigns.map((entry) => {
      const normalizedState = ensureCampaignTime(entry.state, `legacy:${entry.state.campaign.name}:${entry.state.campaign.system}`);
      return normalizedState === entry.state ? entry : { ...entry, state: normalizedState };
    });
    const sorted = sortCampaigns(normalizedCampaigns);
    if (normalizedCampaigns.some((entry, index) => entry !== savedCampaigns[index])) {
      writeCampaignLibrary(sorted);
    }
    campaignsRef.current = sorted;
    setCampaigns(sorted);

    const preferredId = localStorage.getItem(ACTIVE_CAMPAIGN_KEY);
    const active = sorted.find((entry) => entry.id === preferredId) || sorted[0] || null;
    if (active) {
      setActiveCampaignId(active.id);
      setState(active.state);
      localStorage.setItem(ACTIVE_CAMPAIGN_KEY, active.id);
    } else {
      localStorage.removeItem(ACTIVE_CAMPAIGN_KEY);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !activeCampaignId) return;
    if ((state as GameState & { time?: CampaignTimeState }).time) return;
    setState((current) => ensureCampaignTime(current, `legacy:${current.campaign.name}:${current.campaign.system}`));
  }, [ready, activeCampaignId, state]);

  useEffect(() => {
    campaignsRef.current = campaigns;
  }, [campaigns]);

  useEffect(() => {
    if (!ready || !activeCampaignId) return;
    const persist = () => {
      try {
        const current = campaignsRef.current;
        const existing = current.find((entry) => entry.id === activeCampaignId);
        if (!existing) return;
        const next = current.map((entry) =>
          entry.id === activeCampaignId
            ? {
                ...entry,
                state,
                updatedAt: new Date().toISOString(),
              }
            : entry,
        );
        campaignsRef.current = next;
        setCampaigns(next);
        writeCampaignLibrary(next);
        localStorage.setItem(ACTIVE_CAMPAIGN_KEY, activeCampaignId);
      } catch {}
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") persist();
    };
    persist();
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [ready, activeCampaignId, state]);

  const hasSavedCampaign = campaigns.length > 0;
  const cloud = useCloudSync(state, setState, ready, activeCampaignId);
  const bridge = useOracleBridge();

  const contextPreview = useMemo(() => buildContextPacket(state), [state]);
  const lastGmMessage = useMemo(() => latestGmMessage(state.messages), [state.messages]);
  const imageMessage = useMemo(
    () => state.messages.find((message) => message.id === imageMessageId),
    [imageMessageId, state.messages],
  );
  const latestUnansweredPlayer = useMemo(() => {
    let playerIndex = -1;
    for (let index = state.messages.length - 1; index >= 0; index -= 1) {
      if (state.messages[index].role === "player") {
        playerIndex = index;
        break;
      }
    }
    if (playerIndex < 0) return null;
    const answered = state.messages.slice(playerIndex + 1).some((message) => message.role === "gm");
    return answered ? null : state.messages[playerIndex];
  }, [state.messages]);

  const cloudLabel = ({
    local: "somente local",
    connecting: "conectando",
    synced: "sincronizado",
    syncing: "salvando",
    offline: "offline",
    conflict: "conflito",
    error: "erro",
  } as const)[cloud.status];

  const newCampaignAi = {
    connected: Boolean(bridge.account?.connected),
    model: bridge.model,
    respond: bridge.respond,
    onConnect: bridge.connect,
  };

  async function createCloudCampaign() {
    setSyncNote("");
    try {
      await cloud.createCloud();
      setSyncNote("Campanha criada na nuvem. Use o código abaixo no outro dispositivo.");
    } catch {
      setSyncNote("Não foi possível ativar a sincronização.");
    }
  }

  async function joinCloudCampaign() {
    setSyncNote("");
    try {
      await cloud.joinCloud(pairInput);
      setPairInput("");
      setSyncNote("Campanha carregada deste dispositivo.");
    } catch (error) {
      setSyncNote(error instanceof Error ? error.message : "Código inválido.");
    }
  }

  async function copyPairCode() {
    if (!cloud.pairCode) return;
    await navigator.clipboard.writeText(cloud.pairCode);
    setSyncNote("Código copiado.");
  }

  async function prepareSceneImage(message: Message) {
    const snapshot = message.sceneSnapshot || buildSceneSnapshot(state, message.text);
    const prompt = buildSceneImagePrompt(snapshot);
    setState((current) => ({
      ...current,
      messages: current.messages.map((entry) =>
        entry.id === message.id
          ? {
              ...entry,
              sceneSnapshot: snapshot,
              imageDraft: {
                prompt,
                status: "unavailable",
                provider: "chatgpt-plan-sharing",
                createdAt: new Date().toISOString(),
              },
            }
          : entry,
      ),
    }));
    setImageMessageId(message.id);
    setImageNote("");
  }

  async function copySceneImagePrompt() {
    if (!imageMessage?.imageDraft?.prompt) return;
    await navigator.clipboard.writeText(imageMessage.imageDraft.prompt);
    setImageNote("Prompt da cena copiado.");
  }

  function openCampaignLibrary() {
    if (!hasSavedCampaign) return;
    setScreen("campaigns");
  }

  function openCampaign(campaignId: string) {
    const entry = campaignsRef.current.find((campaign) => campaign.id === campaignId);
    if (!entry) return;
    const normalizedState = ensureCampaignTime(entry.state, `legacy:${entry.state.campaign.name}:${entry.state.campaign.system}`);
    setActiveCampaignId(entry.id);
    setState(normalizedState);
    localStorage.setItem(ACTIVE_CAMPAIGN_KEY, entry.id);
    setView("session");
    setScreen("campaign");
  }

  function finishNewCampaign(result: NewCampaignResult) {
    const createdAt = new Date().toISOString();
    const characterName = result.character.name.trim() || "Novo personagem";
    const campaignName = result.campaignName.trim() || "Nova campanha";
    const scene = "Prólogo · Cena inicial";
    const campaignTime = createRandomCampaignTime(`${campaignName}:${crypto.randomUUID()}`);
    const memories: GameState["memories"] = [];
    const remember = (kind: GameState["memories"][number]["kind"], text: string) => {
      memories.push({ id: crypto.randomUUID(), kind, text, createdAt, campaignMinute: campaignTime.campaignMinute });
    };

    remember(
      "fact",
      `${characterName} é ${result.classEntry.name} (${result.subclassEntry.name}), de herança ${result.ancestry.primary.name}${result.ancestry.secondary ? ` e ${result.ancestry.secondary.name}` : ""}, da comunidade ${result.community.entry.name}.`,
    );
    remember("fact", `Sistema da campanha: ${result.system}. Tom definido: ${result.tone}.`);
    if (result.adventureHook?.trim()) {
      remember("event", `Gancho inicial da aventura: ${result.adventureHook.trim()}`);
    }
    if (result.classFeatures.length) {
      remember("fact", `Características de classe de ${characterName}: ${result.classFeatures.map((feature) => feature.name).join(", ")}.`);
    }
    if (result.subclassFeatures.length) {
      remember("fact", `Características de subclasse de ${characterName}: ${result.subclassFeatures.map((feature) => feature.name).join(", ")}.`);
    }
    if (result.ancestry.features.length) {
      remember("fact", `Características de ancestralidade de ${characterName}: ${result.ancestry.features.map((feature) => feature.name).join(", ")}.`);
    }
    if (result.community.features.length) {
      remember("fact", `Característica de comunidade de ${characterName}: ${result.community.features.map((feature) => feature.name).join(", ")}.`);
    }
    remember(
      "fact",
      `Traços de ${characterName}: ${TRAIT_ORDER.map((trait) => `${TRAIT_LABELS[trait]} ${result.traits[trait] >= 0 ? "+" : ""}${result.traits[trait]}`).join(", ")}.`,
    );
    remember("fact", `Experiências iniciais de ${characterName}: ${result.experiences.map((experience) => `${experience} +2`).join("; ")}.`);
    remember("fact", `Cartas de domínio iniciais de ${characterName}: ${result.domainCards.map((card) => `${card.name} (${card.domain})`).join("; ")}.`);
    if (result.equipment.length) {
      remember("fact", `Equipamento inicial de ${characterName}: ${result.equipment.map((item) => item.name).join(", ")}.`);
    }
    remember("event", result.character.history.trim()
      ? `História de ${characterName}: ${result.character.history.trim()}`
      : `${characterName} inicia sua jornada em ${campaignName}.`);

    if (result.character.appearance?.trim()) {
      remember("visual", `Aparência de ${characterName}: ${result.character.appearance.trim()}`);
    } else if (result.character.image) {
      remember("visual", `${characterName} possui uma imagem de referência visual registrada na ficha.`);
    }

    for (const companion of result.companions) {
      const connection = companion.connection.trim();
      remember(
        "fact",
        connection
          ? `${companion.name} (${companion.role}) acompanha o grupo. Vínculo com ${characterName}: ${connection}`
          : `${companion.name} (${companion.role}) acompanha o grupo e acabou de conhecer ${characterName}.`,
      );
      if (companion.appearance?.trim()) {
        remember("visual", `Aparência de ${companion.name}: ${companion.appearance.trim()}`);
      }
    }

    if (result.animalCompanion) {
      remember(
        "fact",
        `${result.animalCompanion.name} é o companheiro animal de ${characterName}${result.animalCompanion.kind ? ` (${result.animalCompanion.kind})` : ""}.`,
      );
      if (result.animalCompanion.appearance?.trim()) {
        remember("visual", `Aparência de ${result.animalCompanion.name}: ${result.animalCompanion.appearance.trim()}`);
      } else if (result.animalCompanion.image) {
        remember("visual", `${result.animalCompanion.name} possui uma imagem de referência visual registrada na ficha.`);
      }
    }

    const companionNames = result.companions.map((companion) => companion.name);
    const initialMessage = companionNames.length
      ? `${characterName}, sua jornada em ${campaignName} está pronta. ${companionNames.join(", ")} ${companionNames.length === 1 ? "está" : "estão"} com você no início do prólogo. Descreva sua primeira ação quando quiser começar.`
      : `${characterName}, sua jornada em ${campaignName} está pronta. O prólogo aguarda sua primeira ação.`;

    const next: GameState = {
      campaign: {
        name: campaignName,
        system: result.system,
        tone: result.tone,
        adventureHook: result.adventureHook?.trim() || undefined,
        session: 1,
        scene,
      },
      time: campaignTime,
      character: {
        id: "player-character",
        name: characterName,
        archetype: `${result.classEntry.name} · ${result.subclassEntry.name}`,
        level: 1,
        hp: 6,
        maxHp: 6,
        hope: 2,
        maxHope: 6,
        stress: 0,
        maxStress: 6,
        armor: result.armorSlots,
        maxArmor: result.armorSlots,
        conditions: [],
        appearance: result.character.appearance?.trim() || undefined,
        daggerheart: {
          class: { id: result.classEntry.id, name: result.classEntry.name },
          subclass: { id: result.subclassEntry.id, name: result.subclassEntry.name },
          classFeatures: result.classFeatures.map((feature) => ({ id: feature.id, name: feature.name })),
          subclassFeatures: result.subclassFeatures.map((feature) => ({ id: feature.id, name: feature.name })),
          ancestry: {
            mixed: result.ancestry.mixed,
            primary: { id: result.ancestry.primary.id, name: result.ancestry.primary.name },
            secondary: result.ancestry.secondary
              ? { id: result.ancestry.secondary.id, name: result.ancestry.secondary.name }
              : undefined,
            features: result.ancestry.features.map((feature) => ({ id: feature.id, name: feature.name })),
          },
          community: {
            id: result.community.entry.id,
            name: result.community.entry.name,
            features: result.community.features.map((feature) => ({ id: feature.id, name: feature.name })),
          },
          traits: result.traits,
          experiences: result.experiences.map((name) => ({ name: name.trim(), bonus: 2 })),
          domains: [...(CLASS_CONFIG[result.classEntry.sourceId || ""]?.domains || Array.from(new Set(result.domainCards.map((card) => card.domain))))],
          domainCards: result.domainCards.map((card) => ({
            id: card.id,
            name: card.name,
            domain: card.domain,
            level: 1,
          })),
          connections: result.companions
            .filter((companion) => companion.connection.trim())
            .map((companion) => ({ npcId: companion.id, text: companion.connection.trim() })),
          history: result.character.history.trim(),
          pronouns: result.character.pronouns.trim() || undefined,
          image: result.character.image || undefined,
          animalCompanion: result.animalCompanion,
        },
      },
      inventory: result.equipment,
      quests: [],
      npcs: result.companions.map((companion) => ({
        id: companion.id,
        name: companion.name,
        role: companion.role,
        relation: "friendly" as const,
        location: scene,
        appearance: companion.appearance.trim() || undefined,
      })),
      memories,
      messages: [{
        id: crypto.randomUUID(),
        role: "gm",
        text: initialMessage,
        createdAt,
        campaignMinute: campaignTime.campaignMinute,
      }],
      events: [],
    };
    next.campaign.restartSnapshot = createCampaignRestartSnapshot(next);
    const localCampaignId = crypto.randomUUID();
    const record: CampaignLibraryEntry = {
      id: localCampaignId,
      state: next,
      createdAt,
      updatedAt: createdAt,
    };
    const nextLibrary = sortCampaigns([...campaignsRef.current, record]);
    campaignsRef.current = nextLibrary;
    setCampaigns(nextLibrary);
    writeCampaignLibrary(nextLibrary);
    localStorage.setItem(ACTIVE_CAMPAIGN_KEY, localCampaignId);
    setActiveCampaignId(localCampaignId);
    setState(next);
    setView("session");
    setScreen("campaign");
  }

  function goHome() {
    setScreen("home");
    setView("session");
  }

  function restartCampaign(campaignId: string) {
    const target = campaignsRef.current.find((entry) => entry.id === campaignId);
    if (!target) return;
    const restarted = restartCampaignFromSnapshot(target.state);
    const updatedAt = new Date().toISOString();
    const next = campaignsRef.current.map((entry) =>
      entry.id === campaignId
        ? { ...entry, state: restarted, updatedAt }
        : entry,
    );
    campaignsRef.current = next;
    setCampaigns(next);
    writeCampaignLibrary(next);
    if (activeCampaignId === campaignId) {
      setState(restarted);
      setInput("");
      setGmError("");
      setImageMessageId(null);
      setImageNote("");
    }
    setCampaignAction(null);
  }

  async function deleteCampaign(campaignId: string) {
    const credentials = readCloudCredentialsForCampaign(campaignId);
    if (credentials) {
      try {
        const response = await fetch(`/api/campaigns/${credentials.campaignId}`, {
          method: "DELETE",
          headers: { authorization: `Bearer ${credentials.syncKey}` },
        });
        if (!response.ok && response.status !== 404) {
          setCampaignActionError("Não foi possível excluir a cópia da nuvem. Verifique a conexão e tente novamente.");
          return;
        }
      } catch {
        setCampaignActionError("Não foi possível falar com a nuvem. A campanha não foi excluída.");
        return;
      }
    }
    removeCloudMetadataForCampaign(campaignId);

    const next = campaignsRef.current.filter((entry) => entry.id !== campaignId);
    campaignsRef.current = next;
    setCampaigns(next);
    writeCampaignLibrary(next);

    if (activeCampaignId === campaignId) {
      const replacement = sortCampaigns(next)[0] || null;
      if (replacement) {
        setActiveCampaignId(replacement.id);
        setState(replacement.state);
        localStorage.setItem(ACTIVE_CAMPAIGN_KEY, replacement.id);
      } else {
        setActiveCampaignId(null);
        setState(initialState);
        localStorage.removeItem(ACTIVE_CAMPAIGN_KEY);
      }
    }
    setCampaignAction(null);
  }

  function connectChatGPT() {
    setShowConnect(true);
  }

  async function logoutChatGPT() {
    await bridge.logout();
    setShowConnect(false);
  }

  function adjust(resource: "hp" | "hope" | "stress" | "armor", amount: number) {
    setState((current) => executeCommand(current, { type: "adjust", resource, amount }));
  }

  function toggleQuestStatus(questId: string) {
    setState((current) => {
      const quest = current.quests.find((entry) => entry.id === questId);
      if (!quest) return current;
      const nextStatus = quest.status === "active" ? "completed" : "active";
      let next = executeCommand(current, { type: "quest", questId, status: nextStatus });
      const linkedEvent = next.time.events.find((entry) => entry.sourceId === questId);
      if (linkedEvent) {
        next = {
          ...next,
          time: updateCalendarEvent(next.time, linkedEvent.id, { completed: nextStatus === "completed" }),
        };
      }
      return next;
    });
  }

  async function runGmNarration(working: GameState, text: string, allowTools = true) {
    if (bridge.status !== "ready" || !bridge.account?.connected || !bridge.model) {
      setShowConnect(true);
      return;
    }

    setGmBusy(true);
    try {
      const conversationInput: unknown[] = buildTurnInput(working, text);
      if (!allowTools) {
        conversationInput.push({
          role: "developer",
          content: "As consequências persistentes desta ação já foram aplicadas anteriormente. Não execute ferramentas nem altere o estado novamente. Produza somente a narração do Mestre coerente com o estado atual.",
        });
      }
      let narration = "";
      let refusal = "";
      let lastOutputTypes: string[] = [];
      let reachedRoundLimit = true;
      for (let round = 0; round < 12; round += 1) {
        const response = await bridge.respond({
          model: bridge.model,
          instructions: gmInstructions(working.campaign.system),
          input: conversationInput,
          ...(allowTools ? { tools: responseTools } : {}),
        });
        const output = Array.isArray(response.output) ? response.output : [];
        const calls = output.filter((item: Record<string, unknown>) => item.type === "function_call");
        lastOutputTypes = output.map((item: Record<string, unknown>) => String(item.type || "unknown"));
        narration = extractNarration(response) || narration;
        refusal = extractRefusal(response) || refusal;

        // store:false is intentionally stateless. Replay the complete model output,
        // including encrypted reasoning items, before the function outputs.
        conversationInput.push(...output);

        // A reasoning model can return a reasoning-only phase. That is not the
        // final answer: keep sampling until a message, refusal, or tool call arrives.
        if (!calls.length) {
          if (narration || refusal) {
            reachedRoundLimit = false;
            break;
          }
          continue;
        }

        for (const call of calls as Array<Record<string, unknown>>) {
          if (!allowTools) continue;
          const executed = executeGmTool(
            working,
            String(call.name || ""),
            String(call.arguments || "{}"),
          );
          working = executed.state;
          conversationInput.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify(executed.result),
            ...(call.caller ? { caller: call.caller } : {}),
          });
        }
        setState(working);
      }

      // Safety valve: if the model spent every round reasoning/using tools without
      // emitting a message, ask one final pass with tools disabled.
      if (!narration && !refusal && reachedRoundLimit) {
        conversationInput.push({
          role: "developer",
          content: "As alterações solicitadas já foram executadas no OracleRPG. Não use novas ferramentas. Produza agora apenas a narração final coerente com os resultados acima.",
        });
        const finalResponse = await bridge.respond({
          model: bridge.model,
          instructions: gmInstructions(working.campaign.system),
          input: conversationInput,
        });
        narration = extractNarration(finalResponse);
        refusal = extractRefusal(finalResponse);
        if (Array.isArray(finalResponse.output)) {
          lastOutputTypes = finalResponse.output.map((item: Record<string, unknown>) => String(item.type || "unknown"));
        }
      }

      if (!narration && refusal) {
        narration = refusal;
      } else if (!narration) {
        const received = lastOutputTypes.length ? lastOutputTypes.join(", ") : "nenhum item";
        narration = `O Mestre não retornou uma mensagem narrativa. Tipos recebidos: ${received}. O estado da campanha foi preservado.`;
      }
      narration = formatNarrationText(narration);
      const sceneSnapshot = buildSceneSnapshot(working, narration);
      working = {
        ...working,
        messages: [
          ...working.messages,
          {
            id: crypto.randomUUID(),
            role: "gm",
            text: narration,
            createdAt: new Date().toISOString(),
            campaignMinute: working.time.campaignMinute,
            sceneSnapshot,
          },
        ],
      };
      setState(working);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao consultar o Mestre.";
      setGmError(message);
      setState((current) => ({
        ...current,
        messages: [
          ...current.messages,
          { id: crypto.randomUUID(), role: "system", text: `Mestre IA indisponível: ${message}`, createdAt: new Date().toISOString(), campaignMinute: current.time.campaignMinute },
        ],
      }));
    } finally {
      setGmBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || gmBusy) return;
    const playerMessage = { id: crypto.randomUUID(), role: "player" as const, text, createdAt: new Date().toISOString(), campaignMinute: state.time.campaignMinute };
    const working: GameState = { ...state, messages: [...state.messages, playerMessage] };
    setState(working);
    setInput("");
    setGmError("");
    if (bridge.status !== "ready" || !bridge.account?.connected || !bridge.model) {
      setShowConnect(true);
      return;
    }
    await runGmNarration(working, text, true);
  }

  async function regenerateNarration(message: Message) {
    if (gmBusy || message.role !== "player") return;
    if (bridge.status !== "ready" || !bridge.account?.connected || !bridge.model) {
      setShowConnect(true);
      return;
    }
    const playerIndex = state.messages.findIndex((entry) => entry.id === message.id);
    if (playerIndex < 0) return;
    const playerTime = Date.parse(message.createdAt);
    const persistentChangesAlreadyApplied = state.events.some((event) =>
      event.actor === "gm-ai"
      && Number.isFinite(playerTime)
      && Date.parse(event.createdAt) >= playerTime
    );
    const working: GameState = {
      ...state,
      messages: state.messages.slice(0, playerIndex + 1),
    };
    setGmError("");
    setState(working);
    await runGmNarration(working, message.text, !persistentChangesAlreadyApplied);
  }

  if (screen === "home") {
    return (
      <main className="appShell homeShell">
        <div className="ambient ambientOne" />
        <div className="ambient ambientTwo" />
        <section className="homeScreen">
          <div className="homeBrand">
            <div className="homeSigil"><img src="/oracle-mark.svg" alt="" /></div>
            <small>ORACLE RPG</small>
            <h1>Onde histórias<br />ganham memória.</h1>
            <p>Campanhas persistentes conduzidas pelo seu Mestre IA.</p>
          </div>

          <div className="homeMenu">
            <button className="homeMenuCard primaryCard" onClick={() => setScreen("newCampaign")}>
              <span className="homeMenuIcon">✦</span>
              <div><strong>Nova campanha</strong><small>Comece uma nova história</small></div>
              <b>›</b>
            </button>

            <button className="homeMenuCard" onClick={openCampaignLibrary} disabled={!hasSavedCampaign}>
              <span className="homeMenuIcon">◈</span>
              <div>
                <strong>Continuar campanha</strong>
                <small>{hasSavedCampaign ? `${campaigns.length} ${campaigns.length === 1 ? "campanha salva" : "campanhas salvas"}` : "Nenhuma campanha salva"}</small>
              </div>
              <b>›</b>
            </button>

            <button className="homeMenuCard" onClick={() => setScreen("compendium")}>
              <span className="homeMenuIcon">⌘</span>
              <div><strong>Compêndio</strong><small>Regras, criaturas, itens e magias</small></div>
              <b>›</b>
            </button>

            <button className="homeMenuCard" onClick={() => setScreen("settings")}>
              <span className="homeMenuIcon">⚙</span>
              <div><strong>Configurações</strong><small>ChatGPT, nuvem e preferências</small></div>
              <b>›</b>
            </button>
          </div>

          <div className="homeFooter">
            <span className={bridge.account?.connected ? "onlineDot connected" : "onlineDot"} />
            {bridge.account?.connected ? "ChatGPT conectado" : "Mestre IA desconectado"}
          </div>
        </section>
      </main>
    );
  }

  if (screen === "campaigns") {
    const orderedCampaigns = sortCampaigns(campaigns);
    const actionTarget = campaignAction
      ? orderedCampaigns.find((entry) => entry.id === campaignAction.campaignId) || null
      : null;

    return (
      <main className="appShell campaignLibraryShell">
        <div className="ambient ambientOne" />
        <div className="ambient ambientTwo" />
        <header className="menuPageHeader">
          <button className="backButton" onClick={goHome}>‹</button>
          <div><small>SUAS HISTÓRIAS</small><strong>Continuar campanha</strong></div>
        </header>
        <section className="campaignLibraryContent">
          <div className="campaignLibraryIntro">
            <div>
              <small>ARQUIVO DO ORACLE</small>
              <h1>Escolha uma campanha.</h1>
              <p>Cada campanha mantém ficha, memória, mensagens e sincronização de forma independente.</p>
            </div>
            <button className="campaignLibraryNew" onClick={() => setScreen("newCampaign")}>✦ Nova campanha</button>
          </div>

          <div className="campaignLibraryList">
            {orderedCampaigns.map((entry) => {
              const campaignState = entry.state;
              const portrait = campaignState.character.daggerheart?.image;
              const activity = campaignActivityAt(campaignState);
              const cloudLinked = Boolean(readCloudCredentialsForCampaign(entry.id));
              return (
                <article className={"campaignLibraryCard " + (entry.id === activeCampaignId ? "active" : "")} key={entry.id}>
                  <div className="campaignLibraryPortrait">
                    {portrait
                      ? <img src={portrait} alt="" />
                      : <span>{campaignState.character.name.slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <div className="campaignLibraryMain">
                    <div className="campaignLibraryTitleRow">
                      <div>
                        <small>{campaignState.campaign.system} · Sessão {campaignState.campaign.session}</small>
                        <h2>{campaignState.campaign.name}</h2>
                      </div>
                      {cloudLinked && <em>☁ Nuvem</em>}
                    </div>
                    <p>{campaignState.character.name} · {campaignState.character.archetype}</p>
                    <div className="campaignLibraryMeta">
                      <span>◉ {campaignState.messages.length} mensagens</span>
                      <span>◇ {campaignState.memories.length} memórias</span>
                      <span>Última atividade: {new Date(activity).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                  <div className="campaignLibraryActions">
                    <button className="open" onClick={() => openCampaign(entry.id)}>Abrir campanha</button>
                    <button
                      className="restart"
                      onClick={() => {
                        setCampaignActionError("");
                        setCampaignAction({ type: "restart", campaignId: entry.id, step: 0 });
                      }}
                    >↺ Recomeçar</button>
                    <button
                      className="delete"
                      onClick={() => {
                        setCampaignActionError("");
                        setCampaignAction({ type: "delete", campaignId: entry.id, step: 0 });
                      }}
                    >Excluir</button>
                  </div>
                </article>
              );
            })}
            {!orderedCampaigns.length && (
              <div className="campaignLibraryEmpty">
                <b>◇</b>
                <h3>Nenhuma campanha salva</h3>
                <p>Crie uma nova campanha para começar uma história.</p>
              </div>
            )}
          </div>

          {actionTarget && campaignAction && (
            <div className="modalBackdrop" onClick={() => {
              setCampaignAction(null);
              setCampaignActionError("");
            }}>
              <section className="connectModal campaignActionModal" onClick={(event) => event.stopPropagation()}>
                <div className={"campaignActionIcon " + campaignAction.type}>{campaignAction.type === "restart" ? "↺" : "×"}</div>
                <small>{campaignAction.type === "restart" ? "RECOMEÇAR CAMPANHA" : "EXCLUIR CAMPANHA"}</small>
                <h2>
                  {campaignAction.type === "restart"
                    ? campaignAction.step === 0 ? "Voltar esta campanha ao início?" : "Apagar todo o progresso desta campanha?"
                    : campaignAction.step === 0 ? "Excluir esta campanha?" : "Esta exclusão é permanente."}
                </h2>
                {campaignAction.type === "restart" ? (
                  campaignAction.step === 0 ? (
                    <>
                      <p>
                        <b>{actionTarget.state.campaign.name}</b> voltará ao momento em que a criação do personagem terminou.
                        As outras campanhas não serão alteradas.
                      </p>
                      <div className="restartWhatResets">
                        <span>✦ Mensagens posteriores serão removidas</span>
                        <span>◉ Memórias posteriores serão removidas</span>
                        <span>◇ Ficha, recursos e inventário voltarão ao estado inicial</span>
                        <span>⌘ NPCs e missões criados depois serão removidos</span>
                      </div>
                      <button
                        className="dangerGhost restartContinue"
                        onClick={() => setCampaignAction({ ...campaignAction, step: 1 })}
                      >Continuar</button>
                    </>
                  ) : (
                    <>
                      <p>Somente <b>{actionTarget.state.campaign.name}</b> será reiniciada. O estado reiniciado será sincronizado com a nuvem quando essa campanha for aberta.</p>
                      <button className="restartConfirmDanger" onClick={() => restartCampaign(actionTarget.id)}>Sim, recomeçar esta campanha</button>
                      <button className="ghost" onClick={() => setCampaignAction({ ...campaignAction, step: 0 })}>Voltar</button>
                    </>
                  )
                ) : (
                  campaignAction.step === 0 ? (
                    <>
                      <p>
                        Isso removerá <b>{actionTarget.state.campaign.name}</b> da lista deste dispositivo
                        {readCloudCredentialsForCampaign(actionTarget.id) ? " e também tentará remover a cópia sincronizada da nuvem." : "."}
                      </p>
                      <button
                        className="dangerGhost restartContinue"
                        onClick={() => setCampaignAction({ ...campaignAction, step: 1 })}
                      >Continuar</button>
                    </>
                  ) : (
                    <>
                      <p>Ficha, mensagens, memórias e progresso desta campanha serão removidos. As demais campanhas permanecem intactas.</p>
                      <button className="restartConfirmDanger" onClick={() => void deleteCampaign(actionTarget.id)}>Sim, excluir esta campanha</button>
                      <button className="ghost" onClick={() => setCampaignAction({ ...campaignAction, step: 0 })}>Voltar</button>
                    </>
                  )
                )}
                {campaignActionError && <p className="modalNote">{campaignActionError}</p>}
                <button className="closeText" onClick={() => {
                  setCampaignAction(null);
                  setCampaignActionError("");
                }}>Cancelar</button>
              </section>
            </div>
          )}
        </section>
      </main>
    );
  }

  if (screen === "newCampaign") {
    return (
      <NewCampaignWizard
        ai={newCampaignAi}
        onBack={goHome}
        onComplete={finishNewCampaign}
      />
    );
  }

  if (screen === "compendium") {
    return <DaggerheartCompendium onBack={goHome} />;
  }

  if (screen === "settings") {
    return (
      <main className="appShell menuPageShell">
        <div className="ambient ambientOne" />
        <div className="ambient ambientTwo" />
        <header className="menuPageHeader">
          <button className="backButton" onClick={goHome}>‹</button>
          <div><small>ORACLE RPG</small><strong>Configurações</strong></div>
        </header>
        <section className="menuPageContent">
          <div className="menuPageIntro"><small>PREFERÊNCIAS</small><h1>Seu Oracle, do seu jeito.</h1></div>
          <div className="settingsList">
            <button onClick={connectChatGPT}>
              <span className="settingsIcon">✦</span>
              <div><strong>ChatGPT</strong><small>{bridge.account?.connected ? bridge.account.name || bridge.account.email || "Conectado" : "Conectar Mestre IA"}</small></div>
              <em className={bridge.account?.connected ? "statusConnected" : ""}>{bridge.account?.connected ? "Conectado" : "Configurar"}</em>
            </button>
            <button onClick={() => setShowSync(true)} disabled={!activeCampaignId}>
              <span className="settingsIcon">☁</span>
              <div><strong>Sincronização</strong><small>{activeCampaignId ? "Campanha ativa entre seus dispositivos" : "Abra uma campanha para configurar"}</small></div>
              <em>{activeCampaignId ? cloudLabel : "Sem campanha"}</em>
            </button>
            <div className="settingsInfo">
              <span className="settingsIcon">ⓘ</span>
              <div><strong>OracleRPG SWIG</strong><small>Sign in with ChatGPT · canal standalone</small></div>
              <em>v0.2.6+</em>
            </div>
          </div>
        </section>

        {showSync && (
          <div className="modalBackdrop" onClick={() => setShowSync(false)}>
            <section className="connectModal syncModal" onClick={(e) => e.stopPropagation()}>
              <img src="/oracle-mark.svg" alt="" />
              <small>SINCRONIZAÇÃO</small>
              <h2>Campanha em todos os seus dispositivos</h2>
              {!cloud.credentials ? (
                <>
                  <p>Crie uma campanha sincronizada ou abra uma existente usando o código de pareamento.</p>
                  <button className="primary enabled" onClick={createCloudCampaign}>Ativar sincronização</button>
                  <div className="divider"><span>ou</span></div>
                  <label className="pairField"><span>Código existente</span><input value={pairInput} onChange={(event) => setPairInput(event.target.value)} placeholder="campaign-id.chave" /></label>
                  <button className="ghost" onClick={joinCloudCampaign} disabled={!pairInput.trim()}>Abrir campanha sincronizada</button>
                </>
              ) : (
                <>
                  <div className="syncState"><i className={cloud.status} /><div><small>ESTADO DA NUVEM</small><strong>{cloudLabel}</strong></div></div>
                  <button className="pairCode" onClick={copyPairCode}>{cloud.pairCode}</button>
                  <button className="ghost" onClick={() => cloud.fetchRemote()}>Atualizar agora</button>
                </>
              )}
              {syncNote && <p className="modalNote">{syncNote}</p>}
              <button className="closeText" onClick={() => setShowSync(false)}>Fechar</button>
            </section>
          </div>
        )}

        {showConnect && (
          <div className="modalBackdrop" onClick={() => setShowConnect(false)}>
            <section className="connectModal" onClick={(e) => e.stopPropagation()}>
              <img src="/oracle-mark.svg" alt="" />
              <small>MESTRE IA</small>
              <h2>{bridge.account?.connected ? "ChatGPT conectado" : "Conectar com ChatGPT"}</h2>
              {bridge.account?.connected ? (
                <>
                  <p>Conectado como <b>{bridge.account.name || bridge.account.email || "conta ChatGPT"}</b>.</p>
                  <button className="ghost" onClick={logoutChatGPT}>Desconectar</button>
                </>
              ) : bridge.status === "ready" ? (
                <button className="primary enabled" onClick={() => bridge.connect()}>Continuar com ChatGPT</button>
              ) : (
                <p>O runtime local do Oracle ainda não foi detectado.</p>
              )}
              <button className="closeText" onClick={() => setShowConnect(false)}>Fechar</button>
            </section>
          </div>
        )}

      </main>
    );
  }

  return (
    <main className="appShell">
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />

      <header className="topbar">
        <button className="brand brandButton" onClick={goHome}>
          <img src="/oracle-mark.svg" alt="" />
          <div><b>ORACLE</b><span>RPG</span></div>
        </button>
        <div className="campaignTitle">
          <small>{state.campaign.system} · Sessão {state.campaign.session}</small>
          <strong>{state.campaign.name}</strong>
        </div>
        <div className="topActions">
          <button className={`cloudStatus ${cloud.status}`} onClick={() => setShowSync(true)}>
            <i /> Nuvem <span>{cloudLabel}</span>
          </button>
          <button className={`connection ${bridge.account?.connected ? "connected" : ""}`} onClick={connectChatGPT}>
            <i /> ChatGPT <span>{bridge.account?.connected ? "conectado" : bridge.status === "missing" ? "bridge offline" : "conectar"}</span>
          </button>
        </div>
      </header>

      <nav className="mobileNav">
        {([
          ["session", "✦", "Sessão"],
          ["character", "◇", "Ficha"],
          ["world", "⌘", "Mundo"],
          ["memory", "◉", "Memória"],
        ] as const).map(([id, icon, label]) => (
          <button className={view === id ? "active" : ""} onClick={() => setView(id)} key={id}><b>{icon}</b>{label}</button>
        ))}
      </nav>

      <section className="workspace">
        <aside className="rail">
          <button className={view === "session" ? "active" : ""} onClick={() => setView("session")}><b>✦</b><span>Sessão</span></button>
          <button className={view === "character" ? "active" : ""} onClick={() => setView("character")}><b>◇</b><span>Personagem</span></button>
          <button className={view === "world" ? "active" : ""} onClick={() => setView("world")}><b>⌘</b><span>Mundo</span></button>
          <button className={view === "memory" ? "active" : ""} onClick={() => setView("memory")}><b>◉</b><span>Memória</span></button>
          <div className="railBottom"><button onClick={() => setShowSync(true)}><b>⚙</b><span>Configurar</span></button></div>
        </aside>

        <section className="content">
          {view === "session" && (
            <div className="sessionGrid">
              <section className="chatPanel panel">
                <div className="panelHeading">
                  <div><small>CENA ATUAL</small><h1>{state.campaign.scene}</h1></div>
                  <span className="livePill">● AO VIVO</span>
                </div>
                <CampaignClockBar time={state.time} onOpenCalendar={() => setShowCalendar(true)} />
                <div className="sceneArt">
                  <div className="sceneMoon" />
                  <div className="sceneDoor"><span>◈</span></div>
                  <div className="sceneFog" />
                  <p>O SANTUÁRIO RESPIRA</p>
                </div>
                <div className="messages">
                  {state.messages.map((message) => (
                    <article className={`message ${message.role}`} key={message.id}>
                      <div className="messageAvatar">{message.role === "gm" ? "◈" : state.character.name.slice(0, 1).toUpperCase()}</div>
                      <div className="messageBody">
                        <small>{message.role === "gm" ? "ORACLE · MESTRE" : message.role === "player" ? state.character.name : "SISTEMA"}</small>
                        <MessageText text={message.text} actionSyntax={message.role === "player"} />
                        {message.role === "gm" && lastGmMessage?.id === message.id && (
                          <button className="sceneImageButton" onClick={() => prepareSceneImage(message)}>
                            <span>✦</span> Gerar imagem da cena
                          </button>
                        )}
                        {message.role === "player" && latestUnansweredPlayer?.id === message.id && (
                          <button className="regenerateNarrationButton" onClick={() => void regenerateNarration(message)} disabled={gmBusy}>
                            <span>↻</span> {gmBusy ? "Gerando narração…" : "Regenerar narração do Mestre"}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                <form className="composer" onSubmit={submit}>
                  <ActionComposer
                    value={input}
                    onChange={setInput}
                    placeholder={gmBusy ? "O Mestre está narrando..." : "O que você faz?"}
                    disabled={gmBusy}
                  />
                  <button className="send" type="submit" disabled={gmBusy}>{gmBusy ? "…" : "➤"}</button>
                </form>
                <div className="composerHint"><span>{gmError ? gmError : "O estado da campanha é salvo no OracleRPG."}</span><span>{bridge.model || "Mestre local"}</span></div>
              </section>

              <aside className="characterPanel panel">
                <div className="characterHero">
                  {state.character.daggerheart?.image
                    ? <img className="characterHeroPortrait" src={state.character.daggerheart.image} alt={`Retrato de ${state.character.name}`} />
                    : <AvatarSigil />}
                  <div><small>PERSONAGEM ATIVO</small><h2>{state.character.name}</h2><p>{state.character.archetype}</p></div>
                  <button>•••</button>
                </div>
                <div className="resourceGrid">
                  <Resource label="Pontos de Vida" value={state.character.hp} max={state.character.maxHp} kind="hp" onAdjust={adjust} />
                  <Resource label="Esperança" value={state.character.hope} max={state.character.maxHope} kind="hope" onAdjust={adjust} />
                  <Resource label={state.campaign.system === "Daggerheart" ? "Fadiga" : "Estresse"} value={state.character.stress} max={state.character.maxStress} kind="stress" onAdjust={adjust} />
                  <Resource label="Armadura" value={state.character.armor} max={state.character.maxArmor} kind="armor" onAdjust={adjust} />
                </div>
                <div className="conditions">
                  <div className="sectionTitle"><span>Condições</span><button onClick={() => setState((s) => executeCommand(s, { type: "condition", name: "Oculta", active: !s.character.conditions.includes("Oculta") }))}>＋</button></div>
                  <div className="chips">{state.character.conditions.length ? state.character.conditions.map((c) => <span key={c}>◌ {c}</span>) : <em>Nenhuma condição</em>}</div>
                </div>
                <div className="inventory">
                  <div className="sectionTitle"><span>Inventário</span><small>{state.inventory.reduce((sum, i) => sum + i.qty, 0)} itens</small></div>
                  {state.inventory.map((item) => (
                    <div className="itemRow" key={item.id}>
                      <b>{item.icon}</b>
                      <div><strong>{item.name}</strong><small>{item.detail}</small></div>
                      <div className="qty">
                        <button onClick={() => setState((s) => executeCommand(s, { type: "inventory", itemId: item.id, amount: -1 }))}>−</button>
                        <span>{item.qty}</span>
                        <button onClick={() => setState((s) => executeCommand(s, { type: "inventory", itemId: item.id, amount: 1 }))}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
                {state.events.length > 0 && (
                  <button className="undo" onClick={() => setState((s) => undoLatest(s))}>↶ Desfazer · {state.events[0].label}</button>
                )}
              </aside>
            </div>
          )}

          {view === "character" && (
            <section className="widePanel panel">
              <div className="eyebrow">PERSONAGEM</div>
              <div className="profileTop">
                {state.character.daggerheart?.image ? (
                  <img
                    src={state.character.daggerheart.image}
                    alt={`Retrato de ${state.character.name}`}
                    style={{ width: 88, height: 88, borderRadius: 20, objectFit: "cover" }}
                  />
                ) : <AvatarSigil />}
                <div><h1>{state.character.name}</h1><p>{state.character.archetype} · {state.campaign.system}</p></div>
              </div>
              <div className="fourCols">
                <Resource label="PV" value={state.character.hp} max={state.character.maxHp} kind="hp" onAdjust={adjust} />
                <Resource label="Esperança" value={state.character.hope} max={state.character.maxHope} kind="hope" onAdjust={adjust} />
                <Resource label={state.campaign.system === "Daggerheart" ? "Fadiga" : "Estresse"} value={state.character.stress} max={state.character.maxStress} kind="stress" onAdjust={adjust} />
                <Resource label="Armadura" value={state.character.armor} max={state.character.maxArmor} kind="armor" onAdjust={adjust} />
              </div>
              {state.character.daggerheart && (
                <>
                  <h3 className="subhead">Daggerheart</h3>
                  <div className="cardGrid">
                    <SheetExpandableCard
                      icon="◇"
                      title={state.character.daggerheart.class.name}
                      subtitle="Classe"
                      entry={findCompendiumEntry(state.character.daggerheart.class.id, state.character.daggerheart.class.name)}
                    />
                    <SheetExpandableCard
                      icon="△"
                      title={state.character.daggerheart.subclass.name}
                      subtitle="Subclasse"
                      entry={findCompendiumEntry(state.character.daggerheart.subclass.id, state.character.daggerheart.subclass.name)}
                    />
                    <SheetExpandableCard
                      icon="◐"
                      title={state.character.daggerheart.ancestry.secondary
                        ? `${state.character.daggerheart.ancestry.primary.name} + ${state.character.daggerheart.ancestry.secondary.name}`
                        : state.character.daggerheart.ancestry.primary.name}
                      subtitle={state.character.daggerheart.ancestry.mixed ? "Ancestralidade mista" : "Ancestralidade"}
                      description={[
                        findCompendiumEntry(state.character.daggerheart.ancestry.primary.id, state.character.daggerheart.ancestry.primary.name)?.description,
                        state.character.daggerheart.ancestry.secondary
                          ? findCompendiumEntry(state.character.daggerheart.ancestry.secondary.id, state.character.daggerheart.ancestry.secondary.name)?.description
                          : "",
                      ].filter(Boolean).join("\n\n")}
                    />
                    <SheetExpandableCard
                      icon="⌂"
                      title={state.character.daggerheart.community.name}
                      subtitle="Comunidade"
                      entry={findCompendiumEntry(state.character.daggerheart.community.id, state.character.daggerheart.community.name)}
                    />
                  </div>

                  <h3 className="subhead">Traços</h3>
                  <div className="cardGrid">
                    {TRAIT_ORDER.map((trait) => {
                      const value = state.character.daggerheart!.traits[trait];
                      return (
                        <article className="miniCard" key={trait}>
                          <b>{value >= 0 ? "+" : ""}{value}</b>
                          <div><h3>{TRAIT_LABELS[trait]}</h3><p>Traço de personagem</p></div>
                        </article>
                      );
                    })}
                  </div>

                  <h3 className="subhead">Características</h3>
                  <div className="cardGrid">
                    {state.character.daggerheart.classFeatures.map((feature) => (
                      <SheetExpandableCard
                        icon="✦"
                        title={feature.name}
                        subtitle="Característica de classe"
                        entry={findCompendiumEntry(feature.id, feature.name)}
                        key={feature.id}
                      />
                    ))}
                    {state.character.daggerheart.subclassFeatures.map((feature) => (
                      <SheetExpandableCard
                        icon="△"
                        title={feature.name}
                        subtitle="Característica de subclasse"
                        entry={findCompendiumEntry(feature.id, feature.name)}
                        key={feature.id}
                      />
                    ))}
                    {state.character.daggerheart.ancestry.features.map((feature) => (
                      <SheetExpandableCard
                        icon="◐"
                        title={feature.name}
                        subtitle="Característica de ancestralidade"
                        entry={findCompendiumEntry(feature.id, feature.name)}
                        key={feature.id}
                      />
                    ))}
                    {state.character.daggerheart.community.features.map((feature) => (
                      <SheetExpandableCard
                        icon="⌂"
                        title={feature.name}
                        subtitle="Característica de comunidade"
                        entry={findCompendiumEntry(feature.id, feature.name)}
                        key={feature.id}
                      />
                    ))}
                  </div>

                  <h3 className="subhead">Experiências</h3>
                  <div className="cardGrid">
                    {state.character.daggerheart.experiences.map((experience) => (
                      <article className="miniCard" key={experience.name}>
                        <b>+{experience.bonus}</b>
                        <div><h3>{experience.name}</h3><p>Experiência inicial</p></div>
                      </article>
                    ))}
                  </div>

                  {state.character.daggerheart.history && (
                    <>
                      <h3 className="subhead">História</h3>
                      <article className="miniCard characterHistoryCard">
                        <b>◉</b>
                        <div><h3>História do personagem</h3><p>{state.character.daggerheart.history}</p></div>
                      </article>
                    </>
                  )}

                  <h3 className="subhead">Cartas de domínio</h3>
                  <div className="cardGrid">
                    {state.character.daggerheart.domainCards.map((card) => (
                      <SheetExpandableCard
                        icon="✦"
                        title={card.name}
                        subtitle={`${card.domain} · Nível ${card.level}`}
                        entry={findCompendiumEntry(card.id, card.name)}
                        key={card.id}
                      />
                    ))}
                  </div>

                  {(state.character.daggerheart.connections.length > 0 || state.character.daggerheart.animalCompanion) && (
                    <>
                      <h3 className="subhead">Conexões</h3>
                      <div className="cardGrid">
                        {state.character.daggerheart.connections.map((connection) => {
                          const npc = state.npcs.find((entry) => entry.id === connection.npcId);
                          return (
                            <article className="miniCard" key={connection.npcId}>
                              <b>◇</b>
                              <div><h3>{npc?.name || "Companheiro"}</h3><p>{connection.text}</p></div>
                            </article>
                          );
                        })}
                        {state.character.daggerheart.animalCompanion && (
                          <article className="miniCard">
                            {state.character.daggerheart.animalCompanion.image ? (
                              <img
                                src={state.character.daggerheart.animalCompanion.image}
                                alt={`Retrato de ${state.character.daggerheart.animalCompanion.name}`}
                                style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover" }}
                              />
                            ) : <b>◒</b>}
                            <div>
                              <h3>{state.character.daggerheart.animalCompanion.name}</h3>
                              <p>
                                {state.character.daggerheart.animalCompanion.kind || "Companheiro animal"}
                                {state.character.daggerheart.animalCompanion.appearance ? ` · ${state.character.daggerheart.animalCompanion.appearance}` : ""}
                              </p>
                            </div>
                          </article>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
              <h3 className="subhead">Inventário</h3>
              <div className="cardGrid">
                {state.inventory.map((item) => {
                  const entry = findCompendiumEntry(item.id, item.name);
                  const description = entry?.description && entry.description !== item.detail
                    ? [item.detail, entry.description].filter(Boolean).join("\n\n")
                    : item.detail;
                  return (
                    <SheetExpandableCard
                      icon={item.icon}
                      title={item.name}
                      subtitle={entry ? entry.type === "weapon" ? "Arma" : entry.type === "armor" ? "Armadura" : entry.type === "consumable" ? "Consumível" : entry.type === "loot" ? "Item de saque" : "Item" : "Item"}
                      entry={entry}
                      description={description}
                      badge={`×${item.qty}`}
                      key={item.id}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {view === "world" && (
            <section className="widePanel panel">
              <div className="eyebrow">MUNDO VIVO</div>
              <h1>NPCs e Missões</h1>
              <div className="worldCols">
                <div><h3 className="subhead">NPCs conhecidos</h3>{state.npcs.map(npc => <article className="npcCard" key={npc.id}><div className={`relation ${npc.relation}`} /><div><h3>{npc.name}</h3><p>{npc.role}</p><small>{npc.location}</small></div><span>{npc.relation}</span></article>)}</div>
                <div>
                  <h3 className="subhead">Missões</h3>
                  {state.quests.map((quest) => {
                    const deadline = quest.deadlineCampaignMinute === undefined ? null : remainingDuration(state.time, quest.deadlineCampaignMinute);
                    return (
                      <article className="questCard" key={quest.id}>
                        <div>
                          <small>{quest.status === "active" ? "EM ANDAMENTO" : "CONCLUÍDA"}</small>
                          <h3>{quest.title}</h3>
                          <p>{quest.stage}</p>
                          {(quest.acceptedAtCampaignMinute !== undefined || quest.deadlineCampaignMinute !== undefined) && (
                            <div className="questTiming">
                              {quest.acceptedAtCampaignMinute !== undefined && (
                                <span>Início · {formatCampaignDateTime(state.time, quest.acceptedAtCampaignMinute, { includeWeekday: false, includeTime: false })}</span>
                              )}
                              {quest.deadlineCampaignMinute !== undefined && (
                                <span className={deadline?.expired && quest.status === "active" ? "expired" : ""}>
                                  Prazo · {formatCampaignDateTime(state.time, quest.deadlineCampaignMinute, { includeWeekday: false, includeTime: true })}
                                  {quest.status === "active" && deadline ? ` · ${deadline.expired ? "encerrado" : `faltam ${formatCampaignDuration(deadline.signedMinutes)}`}` : ""}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <button onClick={() => toggleQuestStatus(quest.id)}>{quest.status === "active" ? "Concluir" : "Reabrir"}</button>
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {view === "memory" && (
            <section className="widePanel panel">
              <div className="eyebrow">MEMÓRIA PERSISTENTE</div>
              <div className="memoryHeader"><div><h1>O Oracle lembra do mundo.</h1><p>Esses dados pertencem à campanha, não à janela de contexto do modelo.</p></div><span>{state.memories.length} registros</span></div>
              <div className="memoryList">{state.memories.map((memory) => {
                const worldDate = memory.campaignMinute === undefined ? null : formatCampaignDateTime(state.time, memory.campaignMinute, { includeWeekday: false, includeTime: true });
                const elapsed = memory.campaignMinute === undefined ? null : state.time.campaignMinute - memory.campaignMinute;
                return <article key={memory.id}><b>{memory.kind === "secret" ? "◇" : memory.kind === "event" ? "✦" : memory.kind === "visual" ? "◐" : "◉"}</b><div><small>{memory.kind.toUpperCase()}{worldDate ? ` · ${worldDate}` : ""}{elapsed !== null && elapsed > 0 ? ` · há ${formatCampaignDuration(elapsed)}` : ""}</small><p>{memory.text}</p></div></article>;
              })}</div>
              <details className="contextPreview"><summary>Prévia do pacote de contexto enviado ao Mestre</summary><pre>{JSON.stringify(contextPreview, null, 2)}</pre></details>
            </section>
          )}
        </section>
      </section>

      {showCalendar && view === "session" && (
        <CampaignCalendarModal time={state.time} onClose={() => setShowCalendar(false)} />
      )}

      {showSync && (
        <div className="modalBackdrop" onClick={() => setShowSync(false)}>
          <section className="connectModal syncModal" onClick={(e) => e.stopPropagation()}>
            <img src="/oracle-mark.svg" alt="" />
            <small>SINCRONIZAÇÃO</small>
            <h2>Campanha em todos os seus dispositivos</h2>
            {!cloud.credentials ? (
              <>
                <p>O Oracle pode guardar a campanha na nuvem sem enviar credenciais do ChatGPT. Você pode criar uma campanha sincronizada ou abrir uma existente usando o código de pareamento.</p>
                <button className="primary enabled" onClick={createCloudCampaign}>Ativar sincronização desta campanha</button>
                <div className="divider"><span>ou</span></div>
                <label className="pairField">
                  <span>Código de outro dispositivo</span>
                  <input value={pairInput} onChange={(event) => setPairInput(event.target.value)} placeholder="campaign-id.chave" />
                </label>
                <button className="ghost" onClick={joinCloudCampaign} disabled={!pairInput.trim()}>Abrir campanha sincronizada</button>
              </>
            ) : (
              <>
                <div className="syncState">
                  <i className={cloud.status} />
                  <div><small>ESTADO DA NUVEM</small><strong>{cloudLabel}</strong></div>
                </div>
                <p>Use este código apenas nos seus dispositivos. Ele funciona como uma chave da campanha e não contém sua conta ChatGPT.</p>
                <button className="pairCode" onClick={copyPairCode} title="Copiar código">{cloud.pairCode}</button>
                {cloud.conflict && (
                  <div className="conflictBox">
                    {(() => {
                      const localSummary = syncStateSummary(state);
                      const remoteSummary = syncStateSummary(cloud.conflict.state);
                      const localLast = Date.parse(state.messages.at(-1)?.createdAt || "");
                      const remoteLast = Date.parse(cloud.conflict.state.messages.at(-1)?.createdAt || "");
                      const localLooksNewer =
                        localSummary.messages > remoteSummary.messages
                        || (
                          localSummary.messages === remoteSummary.messages
                          && Number.isFinite(localLast)
                          && (!Number.isFinite(remoteLast) || localLast > remoteLast)
                        );
                      return (
                        <>
                          <strong>{cloud.conflict.reason === "remote_older" ? "A nuvem parece estar desatualizada." : "Existem alterações diferentes no aparelho e na nuvem."}</strong>
                          <p>Nenhuma versão será descartada automaticamente. Compare antes de escolher.</p>
                          <div className="conflictCompare">
                            <article className={localLooksNewer ? "recommended" : ""}>
                              <small>ESTE DISPOSITIVO {localLooksNewer ? "· MAIS RECENTE" : ""}</small>
                              <b>{localSummary.messages} mensagens</b>
                              <span>Última atividade: {localSummary.latestLabel}</span>
                            </article>
                            <article>
                              <small>NUVEM</small>
                              <b>{remoteSummary.messages} mensagens</b>
                              <span>Última atividade: {remoteSummary.latestLabel}</span>
                            </article>
                          </div>
                          <div className="conflictActions">
                            <button className={localLooksNewer ? "recommended" : ""} onClick={() => cloud.resolveConflict("local")}>Manter este dispositivo</button>
                            <button onClick={() => cloud.resolveConflict("remote")}>Usar versão da nuvem</button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
                {cloud.recovery && cloud.recovery.campaignId === cloud.credentials.campaignId && (
                  <div className="recoveryBox">
                    <div>
                      <small>BACKUP LOCAL DISPONÍVEL</small>
                      <strong>Cópia salva antes de usar a versão da nuvem</strong>
                      <span>{new Date(cloud.recovery.savedAt).toLocaleString("pt-BR")}</span>
                    </div>
                    <button onClick={cloud.restoreRecovery}>Restaurar backup local</button>
                  </div>
                )}
                <button className="ghost" onClick={() => cloud.fetchRemote()}>Atualizar agora</button>
                <button className="dangerGhost" onClick={cloud.disconnectCloud}>Desconectar este dispositivo</button>
              </>
            )}
            {syncNote && <p className="modalNote">{syncNote}</p>}
            <button className="closeText" onClick={() => setShowSync(false)}>Fechar</button>
          </section>
        </div>
      )}

      {showConnect && (
        <div className="modalBackdrop" onClick={() => setShowConnect(false)}>
          <section className="connectModal" onClick={(e) => e.stopPropagation()}>
            <img src="/oracle-mark.svg" alt="" />
            <small>MESTRE IA</small>
            <h2>{bridge.account?.connected ? "ChatGPT conectado" : bridge.status === "missing" ? "Oracle Bridge necessário" : "Conectar com ChatGPT"}</h2>
            {bridge.status === "missing" ? (
              <>
                <p>O plano ChatGPT precisa ser usado pelo runtime local. Inicie o Oracle Bridge neste computador; as credenciais nunca são enviadas ao Vercel ou ao Neon.</p>
                <div className="bridgeCommand"><code>npm install</code><code>npm run bridge</code></div>
                <button className="ghost" onClick={() => bridge.refresh()}>Verificar novamente</button>
              </>
            ) : bridge.account?.connected ? (
              <>
                <p>Conectado localmente como <b>{bridge.account.name || bridge.account.email || "conta ChatGPT"}</b>. O uso da IA conta no limite do próprio plano dessa conta.</p>
                {bridge.models.length > 0 && (
                  <label className="modelPicker">
                    <span>Modelo do Mestre</span>
                    <select value={bridge.model} onChange={(event) => bridge.setModel(event.target.value)}>
                      {bridge.models.map((model) => <option key={model.slug} value={model.slug}>{model.displayName}</option>)}
                    </select>
                  </label>
                )}
                <button className="ghost" onClick={logoutChatGPT}>Desconectar ChatGPT deste dispositivo</button>
              </>
            ) : (
              <>
                <p>O Oracle Bridge está ativo. O login abre no navegador do sistema usando o fluxo open-source oficial; não é necessário API key, empresa ou client secret.</p>
                <button className="primary enabled" onClick={() => bridge.connect()}>Continuar com ChatGPT</button>
              </>
            )}
            <div className="connectFlow"><span>OracleRPG</span><i>→</i><span>Bridge local</span><i>→</i><span>ChatGPT</span></div>
            {bridge.error && <p className="modalNote">{bridge.error}</p>}
            <button className="ghost" onClick={() => setShowConnect(false)}>Continuar em modo manual</button>
          </section>
        </div>
      )}

      {imageMessage && imageMessage.imageDraft && (
        <div className="modalBackdrop" onClick={() => setImageMessageId(null)}>
          <section className="connectModal imageModal" onClick={(event) => event.stopPropagation()}>
            <div className="imageModalIcon">✦</div>
            <small>IMAGEM DA CENA</small>
            <h2>Contexto visual preparado</h2>
            <p>
              O Oracle reuniu a cena, os personagens presentes e as memórias visuais conhecidas.
              A geração de imagem ainda não pode usar o limite do seu plano ChatGPT porque o fluxo
              atual de plan sharing não oferece a tool de image generation.
            </p>
            {imageMessage.sceneSnapshot && (
              <div className="sceneContextCard">
                <strong>{imageMessage.sceneSnapshot.scene}</strong>
                <div className="scenePeople">
                  {imageMessage.sceneSnapshot.participants.map((participant) => (
                    <span key={participant.id}>{participant.name}</span>
                  ))}
                </div>
              </div>
            )}
            <details className="imagePromptPreview">
              <summary>Ver prompt gerado</summary>
              <pre>{imageMessage.imageDraft.prompt}</pre>
            </details>
            <button className="primary enabled" onClick={copySceneImagePrompt}>Copiar prompt da imagem</button>
            {imageNote && <p className="modalNote">{imageNote}</p>}
            <button className="ghost" onClick={() => setImageMessageId(null)}>Fechar</button>
          </section>
        </div>
      )}
    </main>
  );
}

