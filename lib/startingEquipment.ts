import type { CompendiumEntry } from "@/lib/compendium/daggerheart";
import type { InventoryItem } from "@/lib/game";

export type StartingEquipmentSlot = "armor" | "primary" | "secondary" | "consumable" | "personal";
export type StartingLoadout = Partial<Record<StartingEquipmentSlot, string>>;
const RARITIES = ["common", "uncommon", "rare", "very-rare"] as const;
const SLOTS: StartingEquipmentSlot[] = ["armor", "primary", "secondary", "consumable", "personal"];

export function allowedEquipmentRarities(tier: number) {
  const safeTier = Number.isFinite(tier) ? Math.max(1, Math.min(4, Math.trunc(tier))) : 1;
  return RARITIES.slice(0, safeTier);
}

export function canChooseStartingEquipment(entry: CompendiumEntry, tier: number) {
  return entry.category === "equipment" && !entry.creationRestricted
    && allowedEquipmentRarities(tier).some((rarity) => rarity === entry.rarity);
}

export function equipmentFitsSlot(entry: CompendiumEntry, slot: StartingEquipmentSlot) {
  if (slot === "primary" || slot === "secondary") return entry.type === "weapon" && entry.weaponSlot === slot;
  return entry.type === (slot === "personal" ? "loot" : slot);
}

export function chooseStartingEquipment(current: StartingLoadout, slot: StartingEquipmentSlot, id: string | undefined, entries: CompendiumEntry[], tier: number): StartingLoadout {
  if (!id) {
    const next = {...current}; delete next[slot]; return next;
  }
  const entry = entries.find((item) => item.id === id);
  if (!entry || !canChooseStartingEquipment(entry, tier) || !equipmentFitsSlot(entry, slot)) return current;
  if (slot === "secondary" && entries.find((item) => item.id === current.primary)?.hands === 2) return current;
  const next = {...current, [slot]: id};
  if (slot === "primary" && entry.hands === 2) delete next.secondary;
  return next;
}

export function reconcileStartingLoadout(current: StartingLoadout, entries: CompendiumEntry[], tier: number): StartingLoadout {
  let next: StartingLoadout = {};
  for (const slot of SLOTS) {
    if (current[slot]) next = chooseStartingEquipment(next, slot, current[slot], entries, tier);
  }
  return SLOTS.every((slot) => next[slot] === current[slot]) ? current : next;
}

export function startingLoadoutInventory(loadout: StartingLoadout, entries: CompendiumEntry[], tier: number): Array<Omit<InventoryItem, "id">> {
  if (loadout.secondary && entries.find((item) => item.id === loadout.primary)?.hands === 2) throw new Error("Uma arma de duas mãos ocupa também o espaço da secundária.");
  return SLOTS.flatMap((slot) => {
    const id = loadout[slot];
    if (!id) return [];
    const entry = entries.find((item) => item.id === id);
    if (!entry) throw new Error("Equipamento não encontrado no compêndio.");
    if (!canChooseStartingEquipment(entry, tier)) throw new Error(`${entry.name}: raridade indisponível para este patamar.`);
    if (!equipmentFitsSlot(entry, slot)) throw new Error("O tipo de equipamento não corresponde a este espaço.");
    return [{name: entry.name, qty: 1, detail: [entry.equipmentDetail, entry.description].filter(Boolean).join(" · ") || entry.name, icon: entry.type === "weapon" ? "⚔" : entry.type === "armor" ? "⬡" : "◇", sourceId: entry.sourceId, rarity: entry.rarity, ...(entry.art ? {art: entry.art} : {})}];
  });
}

type Preset = {name: string; sourceId?: string};
export function findEquipmentPreset(item: Preset, entries: CompendiumEntry[]) {
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").replace(/[’‘]/g, "'").trim();
  return entries.find((entry) => item.sourceId ? entry.sourceId === item.sourceId : normalize(entry.name) === normalize(item.name));
}

export function suggestedStartingLoadout(items: Preset[], entries: CompendiumEntry[], tier: number): StartingLoadout {
  let loadout: StartingLoadout = {};
  for (const item of items) {
    const entry = findEquipmentPreset(item, entries);
    if (!entry || !["weapon", "armor", "consumable"].includes(entry.type)) continue;
    const slot = entry.type === "weapon" ? entry.weaponSlot : entry.type;
    if (slot && !loadout[slot as StartingEquipmentSlot]) loadout = chooseStartingEquipment(loadout, slot as StartingEquipmentSlot, entry.id, entries, tier);
  }
  return loadout;
}
