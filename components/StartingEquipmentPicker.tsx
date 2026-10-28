"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import EquipmentArt from "@/components/EquipmentArt";
import { type ClassCreationConfig } from "@/lib/characterCreation/daggerheart";
import { type CompendiumEntry, entryTypeLabel } from "@/lib/compendium/daggerheart";
import { daggerheartTierForLevel } from "@/lib/daggerheartCharacter";
import { equipmentRarityLabel } from "@/lib/equipmentRarity";
import { allowedEquipmentRarities, canChooseStartingEquipment, chooseStartingEquipment, equipmentFitsSlot, findEquipmentPreset, suggestedStartingLoadout, type StartingEquipmentSlot, type StartingLoadout } from "@/lib/startingEquipment";

type Props = {level: number; config: ClassCreationConfig; entries: CompendiumEntry[]; value: StartingLoadout; onChange: (next: StartingLoadout) => void; choices: number[]; onChoicesChange: (next: number[]) => void};
const SLOT_LABELS: Record<StartingEquipmentSlot, string> = {armor: "armadura", primary: "arma primária", secondary: "arma secundária", consumable: "consumível", personal: "item pessoal"};
const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");

export default function StartingEquipmentPicker({level, config, entries, value, onChange, choices, onChoicesChange}: Props) {
  const tier = daggerheartTierForLevel(level);
  const [openSlot, setOpenSlot] = useState<StartingEquipmentSlot | null>(null);
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState("all");
  const dialogRef = useRef<HTMLDivElement>(null);
  const potionChoiceName = useId();
  const allowed = allowedEquipmentRarities(tier);
  const primary = entries.find((entry) => entry.id === value.primary);
  const twoHanded = primary?.hands === 2;
  const suggestions = suggestedStartingLoadout(config.suggestedEquipment, entries, tier);
  const potionChoices = entries.filter((entry) => equipmentFitsSlot(entry, "consumable") && canChooseStartingEquipment(entry, tier))
    .toSorted((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const basics = config.suggestedEquipment.filter((item) => {
    const entry = findEquipmentPreset(item, entries);
    return !entry || !["weapon", "armor", "consumable"].includes(entry.type);
  });
  const personal = value.personal ? entries.find((entry) => entry.id === value.personal) : config.equipmentChoices?.[0]?.[choices[0] || 0];
  const options = useMemo(() => entries.filter((entry) => openSlot && equipmentFitsSlot(entry, openSlot) && canChooseStartingEquipment(entry, tier)
    && (rarity === "all" || entry.rarity === rarity)
    && normalize([entry.name, entry.originalName || "", entry.equipmentDetail || "", entry.description].join(" ")).includes(normalize(query.trim())))
    .toSorted((a, b) => allowedEquipmentRarities(tier).indexOf(a.rarity as typeof allowed[number]) - allowedEquipmentRarities(tier).indexOf(b.rarity as typeof allowed[number]) || a.name.localeCompare(b.name, "pt-BR")), [entries, openSlot, tier, rarity, query]);

  useEffect(() => {
    if (!openSlot) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); setOpenSlot(null); }
      if (event.key !== "Tab") return;
      const nodes = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input,select,[tabindex="0"]') || [])];
      const first = nodes[0]; const last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [openSlot]);

  function open(slot: StartingEquipmentSlot) { setQuery(""); setRarity("all"); setOpenSlot(slot); }
  function select(slot: StartingEquipmentSlot, id?: string) {
    if (slot === "personal" && !id) onChoicesChange(choices.map((choice, index) => index === 0 ? -1 : choice));
    onChange(chooseStartingEquipment(value, slot, id, entries, tier));
    setOpenSlot(null);
  }
  function slotCard(slot: StartingEquipmentSlot) {
    const entry = entries.find((item) => item.id === value[slot]);
    const blocked = slot === "secondary" && twoHanded;
    return <div className="loadoutSlotWrap" key={slot}>
      <button type="button" className={"loadoutSlot" + (entry ? " filled" : "") + (blocked ? " blocked" : "")} data-slot={slot} disabled={blocked} onClick={() => open(slot)} aria-label={(entry ? "Trocar " : "Selecionar ") + SLOT_LABELS[slot] + (entry ? ": " + entry.name : "")}>
        {entry ? <><span className="loadoutArt"><EquipmentArt item={entry} /></span><strong>{entry.name}</strong><small className="rarityBadge" data-rarity={entry.rarity}>{equipmentRarityLabel(entry.rarity)}</small><span className="loadoutStats">{entry.equipmentDetail}</span></> : <><b>{blocked ? "Ⅱ" : "+"}</b><strong>{blocked ? "Duas mãos ocupadas" : "Selecionar " + SLOT_LABELS[slot]}</strong>{blocked && <small>O espaço será liberado ao escolher uma arma de uma mão.</small>}</>}
      </button>
      {entry && <button className="loadoutRemove" type="button" onClick={() => select(slot)} aria-label={"Remover " + SLOT_LABELS[slot]}>Remover</button>}
    </div>;
  }
  function suggestion(slot: "armor" | "primary" | "secondary") {
    const entry = entries.find((item) => item.id === suggestions[slot]);
    if (!entry || (slot === "secondary" && twoHanded)) return null;
    return <button type="button" className="loadoutSuggestion" onClick={() => select(slot, entry.id)} aria-label={"Usar sugestão: " + entry.name}><span><EquipmentArt item={entry} /></span><div><small>SUGESTÃO DA CLASSE</small><strong>{entry.name}</strong></div></button>;
  }

  return <div className="startingEquipmentPicker">
    <div className="loadoutAllowance"><div><strong>Nível {level} · Patamar {tier}</strong><span>Raridades disponíveis: {allowed.map(equipmentRarityLabel).join(" · ")}</span></div><button type="button" onClick={() => {onChoicesChange((config.equipmentChoices || []).map(() => 0)); onChange(suggestions);}}>Usar conjunto sugerido</button></div>
    <div className="loadoutMainGrid">
      <fieldset className="loadoutPanel"><legend>Armadura</legend>{slotCard("armor")}{suggestion("armor")}</fieldset>
      <fieldset className="loadoutPanel"><legend>Armas</legend><div className="loadoutWeapons"><div>{slotCard("primary")}{suggestion("primary")}</div><div>{slotCard("secondary")}{suggestion("secondary")}</div></div></fieldset>
    </div>
    <div className="loadoutChoicesGrid">
      <fieldset className="loadoutPanel"><legend>Itens iniciais</legend><div className="loadoutBasics">{basics.map((item, index) => <div key={item.name + index}><span><EquipmentArt item={item} /></span><strong>{item.name}</strong><small>{item.detail}</small></div>)}</div></fieldset>
      <fieldset className="loadoutPanel"><legend>Poção inicial</legend>
        <p className="loadoutHint">Escolha uma poção de cura ou de vigor.</p>
        <div className="loadoutPotionChoices">{potionChoices.map((entry) => {
          const label = entry.sourceId === "Minor Health Potion" ? "Poção de cura menor" : entry.name;
          return <label className={"loadoutPotionChoice" + (value.consumable === entry.id ? " selected" : "")} key={entry.id}>
            <input type="radio" name={potionChoiceName} value={entry.id} checked={value.consumable === entry.id} onChange={() => select("consumable", entry.id)} />
            <span className="loadoutPotionArt"><EquipmentArt item={entry} /></span>
            <strong>{label}</strong><small>{entry.description}</small>
          </label>;
        })}</div>
      </fieldset>
      <fieldset className="loadoutPanel"><legend>Item pessoal</legend>{personal && <div className="loadoutPersonal"><span><EquipmentArt item={personal} /></span><strong>{personal.name}</strong><small className="rarityBadge" data-rarity={"rarity" in personal ? personal.rarity : "common"}>{equipmentRarityLabel("rarity" in personal ? personal.rarity : "common")}</small></div>}
        {(config.equipmentChoices || []).map((group, groupIndex) => <div className="loadoutTrinkets" key={groupIndex}>{group.map((item, index) => <button type="button" aria-pressed={!value.personal && (choices[groupIndex] || 0) === index} key={item.name} onClick={() => {onChoicesChange(choices.map((choice, i) => i === groupIndex ? index : choice)); if (value.personal) onChange(chooseStartingEquipment(value, "personal", undefined, entries, tier));}}>{item.name}</button>)}</div>)}
        <button type="button" className="loadoutBrowsePersonal" data-slot="personal" onClick={() => open("personal")}>{value.personal ? "Trocar item do compêndio" : "Escolher item do compêndio"}</button>
      </fieldset>
    </div>
    {openSlot && createPortal(<div className="loadoutModalBackdrop" onClick={() => setOpenSlot(null)}><div className="loadoutModal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="loadout-dialog-title" onClick={(event) => event.stopPropagation()}>
      <header><div><small>COMPÊNDIO · PATAMAR {tier}</small><h2 id="loadout-dialog-title">Selecionar {SLOT_LABELS[openSlot]}</h2><p>Até {equipmentRarityLabel(allowed.at(-1))}. {options.length} opções disponíveis.</p></div><button type="button" className="loadoutModalClose" onClick={() => setOpenSlot(null)} aria-label="Fechar seleção de equipamento">×</button></header>
      <div className="loadoutCatalogFilters"><label><span>Buscar</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, efeito ou atributo…" /></label><label><span>Raridade</span><select value={rarity} onChange={(event) => setRarity(event.target.value)}><option value="all">Todas disponíveis</option>{allowed.map((r) => <option value={r} key={r}>{equipmentRarityLabel(r)}</option>)}</select></label></div>
      <div className="loadoutCatalog">{options.map((entry) => <button type="button" className={"loadoutCatalogItem" + (value[openSlot] === entry.id ? " selected" : "")} data-entry-id={entry.id} data-rarity={entry.rarity} aria-pressed={value[openSlot] === entry.id} onClick={() => select(openSlot, entry.id)} key={entry.id}><span className="loadoutCatalogArt"><EquipmentArt item={entry} /></span><div><small>{entryTypeLabel(entry.type)} · <span className="rarityBadge" data-rarity={entry.rarity}>{equipmentRarityLabel(entry.rarity)}</span></small><strong>{entry.name}</strong>{entry.equipmentDetail && <span className="loadoutStats">{entry.equipmentDetail}</span>}<p>{entry.description || "Sem característica adicional."}</p></div><b>{value[openSlot] === entry.id ? "✓" : "+"}</b></button>)}{!options.length && <p className="loadoutCatalogEmpty">Nenhum item encontrado entre as raridades disponíveis.</p>}</div>
      <footer><span>Você pode consultar todos os itens no compêndio.</span><button type="button" onClick={() => select(openSlot)}>Deixar este espaço vazio</button></footer>
    </div></div>, document.body)}
  </div>;
}
