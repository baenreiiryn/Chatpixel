"use client";

import { useMemo, useState } from "react";
import type { CampaignTimeState } from "@/lib/campaignTime";
import type { TimelineEntry, TimelineKind } from "@/lib/game";
import {
  formatTimelineEntryDate,
  timelineElapsedMinutes,
  timelineEntrySortValue,
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
}: {
  entries: TimelineEntry[];
  time: CampaignTimeState;
  onShowDetails: () => void;
}) {
  const [kind, setKind] = useState<TimelineKind | "all">("all");
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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

  return (
    <section className="campaignTimelinePanel">
      <header className="campaignTimelineHeader">
        <div>
          <div className="eyebrow">MEMÓRIA DA CAMPANHA</div>
          <h1>Linha do tempo</h1>
          <p>Acontecimentos e descobertas registrados pelo Mestre na ordem em que ocorreram no mundo.</p>
        </div>
        <button type="button" className="timelineDetailsButton" onClick={onShowDetails}>Detalhes</button>
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
                        {entry.importance === "major" && <b>MARCO</b>}
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
          <p>{visibleEntries.length ? "Os filtros atuais não encontraram entradas." : "Quando algo importante acontecer ou for descoberto, o Mestre registrará aqui."}</p>
        </div>
      )}
    </section>
  );
}
