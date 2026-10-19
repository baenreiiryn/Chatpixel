"use client";

import { useMemo, useState } from "react";
import {
  daggerheartCompendium,
  entryTypeLabel,
  mechanicsSummary,
  type CompendiumEntry,
} from "@/lib/compendium/daggerheart";

type Props = {
  onBack: () => void;
};

const TYPE_ORDER: Record<string, number> = {
  rule: 0,
  trait: 1,
  range: 2,
  condition: 3,
  deathMove: 4,
  class: 0,
  ancestry: 0,
  community: 0,
  subclass: 0,
  adversary: 0,
  classFeature: 1,
  ancestryFeature: 1,
  communityFeature: 1,
  subclassFeature: 1,
  domainCard: 0,
  weapon: 0,
  armor: 1,
  consumable: 2,
  loot: 3,
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

function shortDescription(value: string, max = 170) {
  if (value.length <= max) return value;
  const sliced = value.slice(0, max);
  const lastSpace = sliced.lastIndexOf(" ");
  return sliced.slice(0, lastSpace > 100 ? lastSpace : max) + "…";
}

function Mechanics({ entry, expanded = false }: { entry: CompendiumEntry; expanded?: boolean }) {
  const items = mechanicsSummary(entry);
  if (!items.length) return null;
  const visible = expanded ? items : items.slice(0, 4);
  return (
    <div className={"compMechanics" + (expanded ? " expanded" : "")}>
      {visible.map((item, index) => (
        <span className={"mechanicChip " + item.kind} key={item.kind + item.label + index}>
          {item.kind === "cost" ? "◆" : item.kind === "damage" ? "✦" : item.kind === "test" ? "◇" : item.kind === "difficulty" ? "◎" : item.kind === "range" ? "⌁" : "◷"}
          {item.label}
        </span>
      ))}
    </div>
  );
}

function EntryCard({ entry, onOpen }: { entry: CompendiumEntry; onOpen: () => void }) {
  return (
    <button className={"compEntryCard " + (entry.art ? "withArt" : "")} onClick={onOpen}>
      {entry.art ? (
        <div className="compEntryArt"><img src={entry.art} alt="" loading="lazy" /></div>
      ) : (
        <div className="compEntryGlyph">{entry.category === "domains" ? "◈" : entry.category === "classes" ? "✦" : entry.category === "ancestries" ? "◐" : entry.category === "equipment" ? "⚔" : entry.category === "adversaries" ? "♜" : "◇"}</div>
      )}
      <div className="compEntryBody">
        <div className="compEntryMeta">
          <span>{entryTypeLabel(entry.type)}</span>
          {entry.source === "expansion" && <em>Expansão</em>}
        </div>
        <h3>{entry.name}</h3>
        <p>{shortDescription(entry.description || entry.motivesAndTactics || "Sem descrição.")}</p>
        <Mechanics entry={entry} />
      </div>
      <b className="compEntryArrow">›</b>
    </button>
  );
}

function EntryDetail({
  entry,
  related,
  onClose,
  onOpen,
}: {
  entry: CompendiumEntry;
  related: CompendiumEntry[];
  onClose: () => void;
  onOpen: (entry: CompendiumEntry) => void;
}) {
  const paragraphs = (entry.description || "").split(/\n{2,}/).filter(Boolean);
  return (
    <div className="compDetailBackdrop" onClick={onClose}>
      <article className="compDetail" onClick={(event) => event.stopPropagation()}>
        <button className="compDetailClose" onClick={onClose}>×</button>
        {entry.art && <div className="compDetailHero"><img src={entry.art} alt={entry.name} /></div>}
        <div className="compDetailContent">
          <div className="compDetailMeta">
            <span>{entryTypeLabel(entry.type)}</span>
            <i>{entry.source === "expansion" ? "Conteúdo de expansão" : entry.source === "srd2" ? "SRD 2.0" : entry.source === "srd" ? "SRD" : "Daggerheart"}</i>
          </div>
          <h2>{entry.name}</h2>
          {entry.originalName && entry.originalName !== entry.name && <small className="compOriginalName">{entry.originalName}</small>}
          <Mechanics entry={entry} expanded />
          {entry.motivesAndTactics && (
            <div className="compTactics">
              <small>MOTIVAÇÕES E TÁTICAS</small>
              <p>{entry.motivesAndTactics}</p>
            </div>
          )}
          <div className="compDescription">
            {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
          </div>
          {!!related.length && (
            <section className="compRelated">
              <small>CONTEÚDO RELACIONADO</small>
              <div>
                {related.map((item) => (
                  <button onClick={() => onOpen(item)} key={item.id}>
                    <span>◇</span>
                    <div><strong>{item.name}</strong><small>{shortDescription(item.description, 85)}</small></div>
                    <b>›</b>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </article>
    </div>
  );
}

export default function DaggerheartCompendium({ onBack }: Props) {
  const [category, setCategory] = useState("rules");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => daggerheartCompendium.entries.find((entry) => entry.id === selectedId) || null,
    [selectedId],
  );
  const related = useMemo(
    () => selected?.sourceId
      ? daggerheartCompendium.entries.filter((entry) => entry.parent === selected.sourceId)
      : [],
    [selected],
  );

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of daggerheartCompendium.entries) {
      map.set(entry.category, (map.get(entry.category) || 0) + 1);
    }
    return map;
  }, []);

  const filtered = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    return daggerheartCompendium.entries
      .filter((entry) => {
        if (category !== "all" && entry.category !== category) return false;
        if (!normalizedQuery) return true;
        const haystack = normalize([
          entry.name,
          entry.originalName || "",
          entry.description,
          entry.motivesAndTactics || "",
          entryTypeLabel(entry.type),
        ].join(" "));
        return haystack.includes(normalizedQuery);
      })
      .sort((a, b) => {
        const type = (TYPE_ORDER[a.type] || 0) - (TYPE_ORDER[b.type] || 0);
        return type || a.name.localeCompare(b.name, "pt-BR");
      });
  }, [category, query]);

  const activeCategory = daggerheartCompendium.categories.find((item) => item.id === category);

  return (
    <main className="appShell compendiumShell">
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />
      <header className="menuPageHeader compendiumHeader">
        <button className="backButton" onClick={onBack}>‹</button>
        <div><small>DAGGERHEART</small><strong>Compêndio</strong></div>
        <span className="compendiumCount">{daggerheartCompendium.entries.length} entradas</span>
      </header>

      <section className="compendiumLayout">
        <aside className="compendiumCategories">
          <div className="compendiumSource">
            <div className="compendiumSourceSigil">◇</div>
            <div><small>SISTEMA</small><strong>Daggerheart</strong><span>PT-BR · SRD</span></div>
          </div>
          <button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>
            <b>⌕</b><span><strong>Todos</strong><small>{daggerheartCompendium.entries.length}</small></span>
          </button>
          {daggerheartCompendium.categories.map((item) => (
            <button className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)} key={item.id}>
              <b>{item.icon}</b><span><strong>{item.name}</strong><small>{counts.get(item.id) || 0}</small></span>
            </button>
          ))}
          <div className="compendiumCredits">
            <small>FONTES</small>
            <p>Tradução PT-BR não oficial do SRD. Artes de adversários sob CC0.</p>
          </div>
        </aside>

        <section className="compendiumContent">
          <div className="compendiumTitleRow">
            <div>
              <small>REFERÊNCIA RÁPIDA</small>
              <h1>{category === "all" ? "Todo o compêndio" : activeCategory?.name}</h1>
              <p>{category === "all" ? "Pesquise regras, características, cartas, equipamentos e adversários." : activeCategory?.description}</p>
            </div>
          </div>

          <label className="compendiumSearch">
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, regra, recurso ou efeito…" />
            {query && <button onClick={() => setQuery("")}>×</button>}
          </label>

          <div className="compendiumMobileCategories">
            <button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>Todos</button>
            {daggerheartCompendium.categories.map((item) => (
              <button className={category === item.id ? "active" : ""} onClick={() => setCategory(item.id)} key={item.id}>{item.name}</button>
            ))}
          </div>

          <div className="compendiumResultBar">
            <span>{filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}</span>
            {query && <small>para “{query}”</small>}
          </div>

          <div className="compendiumEntries">
            {filtered.map((entry) => <EntryCard entry={entry} onOpen={() => setSelectedId(entry.id)} key={entry.id} />)}
            {!filtered.length && (
              <div className="compendiumEmpty"><b>◇</b><h3>Nada encontrado</h3><p>Tente outro termo ou escolha uma categoria diferente.</p></div>
            )}
          </div>
        </section>
      </section>

      {selected && (
        <EntryDetail
          entry={selected}
          related={related}
          onClose={() => setSelectedId(null)}
          onOpen={(entry) => setSelectedId(entry.id)}
        />
      )}
    </main>
  );
}
