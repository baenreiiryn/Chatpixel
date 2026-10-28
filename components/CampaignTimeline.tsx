"use client";

import { FormEvent, useMemo, useState } from "react";
import { deriveCampaignDateTime, type CampaignTimeState } from "@/lib/campaignTime";
import type { TimelineEntry, TimelineKind } from "@/lib/game";
import {
  formatTimelineEntryDate,
  type ManualTimelineEntryInput,
  timelineElapsedMinutes,
  timelineEntrySortValue,
  timelineEntryWorldDate,
} from "@/lib/timeline";

const KIND_META: Record<TimelineKind, { label: string; icon: string }> = {
  discovery: { label: "Descoberta", icon: "✦" },
  quest: { label: "Missão", icon: "!" },
  combat: { label: "Conflito", icon: "⚔" },
  travel: { label: "Viagem", icon: "⌁" },
  relationship: { label: "Relação", icon: "◇" },
  world: { label: "Mundo", icon: "◉" },
  milestone: { label: "Marco", icon: "◆" },
  other: { label: "Evento", icon: "•" },
};

function elapsedLabel(minutes: number, daysPerYear: number) {
  const total = Math.max(0, Math.trunc(minutes));
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (daysPerYear > 0 && days >= daysPerYear) {
    const years = Math.floor(days / daysPerYear);
    const remainingDays = days % daysPerYear;
    return `há ${years} ano${years === 1 ? "" : "s"}${remainingDays ? ` e ${remainingDays}d` : ""}`;
  }
  if (days > 0) return `há ${days}d${hours ? ` ${hours}h` : ""}`;
  if (hours > 0) return `há ${hours}h${mins ? ` ${mins}min` : ""}`;
  return mins > 0 ? `há ${mins}min` : "agora";
}

export default function CampaignTimeline({
  entries,
  time,
  onShowDetails,
  onSaveEntry,
}: {
  entries: TimelineEntry[];
  time: CampaignTimeState;
  onShowDetails: () => void;
  onSaveEntry: (input: ManualTimelineEntryInput, entryId?: string) => string | null;
}) {
  const [kind, setKind] = useState<TimelineKind | "all">("all");
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{
    entryId?: string;
    title: string;
    description: string;
    kind: TimelineKind;
    tags: string;
    importance: "normal" | "major";
    year: number;
    monthIndex: number;
    day: number;
    hour: number;
    minute: number;
  } | null>(null);
  const [editorError, setEditorError] = useState("");

  const visibleEntries = useMemo(
    () => entries
      .filter((entry) => entry.visibility === "public")
      .sort((a, b) => timelineEntrySortValue(time, a) - timelineEntrySortValue(time, b) || Date.parse(a.createdAt) - Date.parse(b.createdAt)),
    [entries, time],
  );

  const usedKinds = useMemo(() => Array.from(new Set(visibleEntries.map((entry) => entry.kind))), [visibleEntries]);
  const tags = useMemo(
    () => Array.from(new Set(visibleEntries.flatMap((entry) => entry.tags || []))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [visibleEntries],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = visibleEntries.filter((entry) => {
    if (kind !== "all" && entry.kind !== kind) return false;
    if (tag && !entry.tags.includes(tag)) return false;
    if (!normalizedQuery) return true;
    return [entry.title, entry.description, ...entry.tags]
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(normalizedQuery);
  });

  function openNewEntry() {
    const current = deriveCampaignDateTime(time);
    setEditor({
      title: "",
      description: "",
      kind: "other",
      tags: "",
      importance: "normal",
      year: current.year,
      monthIndex: current.monthIndex,
      day: current.day,
      hour: current.hour,
      minute: current.minute,
    });
    setEditorError("");
  }

  function openEditEntry(entry: TimelineEntry) {
    const date = timelineEntryWorldDate(time, entry);
    setEditor({
      entryId: entry.id,
      title: entry.title,
      description: entry.description,
      kind: entry.kind,
      tags: (entry.tags || []).join(", "),
      importance: entry.importance,
      year: date.year,
      monthIndex: date.monthIndex,
      day: date.day,
      hour: date.hour,
      minute: date.minute,
    });
    setEditorError("");
  }

  function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    const error = onSaveEntry({
      title: editor.title,
      description: editor.description,
      kind: editor.kind,
      tags: editor.tags.split(",").map((item) => item.trim()).filter(Boolean),
      importance: editor.importance,
      year: editor.year,
      monthIndex: editor.monthIndex,
      day: editor.day,
      hour: editor.hour,
      minute: editor.minute,
    }, editor.entryId);
    if (error) {
      setEditorError(error);
      return;
    }
    setEditor(null);
    setEditorError("");
  }

  return (
    <section className="campaignTimelinePanel">
      <header className="campaignTimelineHeader">
        <div>
          <div className="eyebrow">MEMÓRIA DA CAMPANHA</div>
          <h1>Linha do tempo</h1>
          <p>Acontecimentos e descobertas da campanha na ordem em que ocorreram no mundo. Você também pode corrigir ou registrar fatos manualmente.</p>
        </div>
        <div className="timelineHeaderActions">
          <button type="button" className="timelineAddButton" onClick={openNewEntry}>＋ Adicionar evento</button>
          <button type="button" className="timelineDetailsButton" onClick={onShowDetails}>Detalhes</button>
        </div>
      </header>

      <div className="timelineFilters">
        <label className="timelineSearch">
          <span>⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no timeline..." />
        </label>
        <div className="timelineKindFilters">
          <button className={kind === "all" ? "active" : ""} onClick={() => setKind("all")}>Todos</button>
          {usedKinds.map((item) => (
            <button className={kind === item ? "active" : ""} onClick={() => setKind(item)} key={item}>
              {KIND_META[item].icon} {KIND_META[item].label}
            </button>
          ))}
        </div>
        {tags.length > 0 && (
          <div className="timelineTagFilters">
            {tags.map((item) => (
              <button className={tag === item ? "active" : ""} onClick={() => setTag(tag === item ? null : item)} key={item}>#{item}</button>
            ))}
          </div>
        )}
      </div>

      {filtered.length ? (
        <div className="verticalTimeline">
          {filtered.map((entry, index) => {
            const meta = KIND_META[entry.kind] || KIND_META.other;
            const date = formatTimelineEntryDate(time, entry, true);
            const elapsed = elapsedLabel(
              timelineElapsedMinutes(time, entry),
              time.calendar.months.reduce((total, month) => total + month.days, 0),
            );
            return (
              <article className={`timelineEntry kind-${entry.kind} ${entry.importance === "major" ? "major" : ""}`} key={entry.id}>
                <div className="timelineRailCell">
                  <span className="timelineDot">{meta.icon}</span>
                  {index < filtered.length - 1 && <i className="timelineLine" />}
                </div>
                <div className="timelineEntryContent">
                  <div className="timelineEntryMeta">
                    <span>{date}</span>
                    <em>{elapsed}</em>
                  </div>
                  <div className={"timelineEntryCard" + (entry.image ? " withImage" : "")}>
                    {entry.image && <img src={entry.image} alt="" className="timelineEntryImage" loading="lazy" />}
                    <div className="timelineEntryBody">
                      <div className="timelineEntryTitleRow">
                        <small>{meta.label.toUpperCase()}</small>
                        <div>
                          {entry.importance === "major" && <b>MARCO</b>}
                          <button type="button" onClick={() => openEditEntry(entry)}>Editar</button>
                        </div>
                      </div>
                      <h2>{entry.title}</h2>
                      {entry.description && <p>{entry.description}</p>}
                      {entry.tags.length > 0 && (
                        <div className="timelineEntryTags">
                          {entry.tags.map((item) => <span key={item}>#{item}</span>)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="timelineEmpty">
          <b>◌</b>
          <h3>Nenhum acontecimento aqui ainda.</h3>
          <p>{visibleEntries.length ? "Os filtros atuais não encontraram entradas." : "Você pode registrar manualmente acontecimentos do gancho, da história da personagem ou da própria campanha."}</p>
          {!visibleEntries.length && <button type="button" onClick={openNewEntry}>Adicionar primeiro evento</button>}
        </div>
      )}

      {editor && (
        <div className="modalBackdrop timelineEditorBackdrop" onClick={() => setEditor(null)}>
          <form className="timelineEditorModal" onSubmit={submitEditor} onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <small>{editor.entryId ? "EDITAR ACONTECIMENTO" : "NOVO ACONTECIMENTO"}</small>
                <h2>{editor.entryId ? "Corrigir evento da timeline" : "Adicionar à timeline"}</h2>
                <p>Use um evento por registro. A data pode ser estimada quando a história não informar um momento exato.</p>
              </div>
              <button type="button" aria-label="Fechar" onClick={() => setEditor(null)}>×</button>
            </header>

            <div className="timelineEditorFields">
              <label className="timelineEditorWide">
                <span>Título</span>
                <input
                  value={editor.title}
                  maxLength={90}
                  placeholder="Ex.: Zervyna entrou na Academia Deathlock"
                  onChange={(event) => setEditor({ ...editor, title: event.target.value })}
                  autoFocus
                />
              </label>
              <label className="timelineEditorWide">
                <span>Descrição</span>
                <textarea
                  value={editor.description}
                  maxLength={360}
                  rows={4}
                  placeholder="Descreva apenas este acontecimento."
                  onChange={(event) => setEditor({ ...editor, description: event.target.value })}
                />
              </label>
              <label>
                <span>Tipo</span>
                <select value={editor.kind} onChange={(event) => setEditor({ ...editor, kind: event.target.value as TimelineKind })}>
                  {Object.entries(KIND_META).map(([value, meta]) => <option value={value} key={value}>{meta.label}</option>)}
                </select>
              </label>
              <label>
                <span>Importância</span>
                <select value={editor.importance} onChange={(event) => setEditor({ ...editor, importance: event.target.value as "normal" | "major" })}>
                  <option value="normal">Normal</option>
                  <option value="major">Marco importante</option>
                </select>
              </label>
              <label className="timelineEditorWide">
                <span>Tags <em>separadas por vírgula</em></span>
                <input value={editor.tags} placeholder="Academia, Zervyna" onChange={(event) => setEditor({ ...editor, tags: event.target.value })} />
              </label>
            </div>

            <div className="timelineEditorDate">
              <small>DATA NO MUNDO</small>
              <div>
                <label><span>Ano</span><input type="number" value={editor.year} onChange={(event) => setEditor({ ...editor, year: Number(event.target.value) })} /></label>
                <label>
                  <span>Mês</span>
                  <select value={editor.monthIndex} onChange={(event) => {
                    const monthIndex = Number(event.target.value);
                    const maxDay = time.calendar.months[monthIndex]?.days || 1;
                    setEditor({ ...editor, monthIndex, day: Math.min(editor.day, maxDay) });
                  }}>
                    {time.calendar.months.map((month, index) => <option value={index} key={month.id}>{month.name}</option>)}
                  </select>
                </label>
                <label><span>Dia</span><input type="number" min={1} max={time.calendar.months[editor.monthIndex]?.days || 1} value={editor.day} onChange={(event) => setEditor({ ...editor, day: Number(event.target.value) })} /></label>
                <label><span>Hora</span><input type="number" min={0} max={23} value={editor.hour} onChange={(event) => setEditor({ ...editor, hour: Number(event.target.value) })} /></label>
                <label><span>Minuto</span><input type="number" min={0} max={59} value={editor.minute} onChange={(event) => setEditor({ ...editor, minute: Number(event.target.value) })} /></label>
              </div>
            </div>

            {editorError && <p className="timelineEditorError">{editorError}</p>}
            <footer>
              <button type="button" className="timelineEditorCancel" onClick={() => setEditor(null)}>Cancelar</button>
              <button type="submit" className="timelineEditorSave">{editor.entryId ? "Salvar alterações" : "Adicionar evento"}</button>
            </footer>
          </form>
        </div>
      )}
    </section>
  );
}
