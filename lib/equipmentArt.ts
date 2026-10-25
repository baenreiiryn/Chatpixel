import manifest from "./compendium/equipment-art.manifest.json" with { type: "json" };

export type EquipmentArtIdentity = {
  id?: string;
  sourceId?: string;
  name: string;
  type?: string;
  rarity?: string;
};

type ArtRecord = (typeof manifest.entries)[number];
const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").trim();
const byId = new Map(manifest.entries.map((item) => [item.id, item]));
const bySource = new Map<string, ArtRecord[]>();
const byName = new Map<string, ArtRecord[]>();
for (const item of manifest.entries) {
  for (const [index, key] of [[bySource, item.sourceId], [byName, normalize(item.name)]] as const) {
    const matches = index.get(key) || [];
    matches.push(item);
    index.set(key, matches);
  }
}
const bonusAliases = new Map([
  ["corda", "bonus-rope"],
  ["corda de seda", "bonus-rope"],
]);

/** Resolve by stable identity first; ambiguous translated names must not pick a tier at random. */
export function resolveEquipmentArt(item: EquipmentArtIdentity): string | undefined {
  const exact = item.id ? byId.get(item.id) : undefined;
  if (exact) return exact.art;
  const matches = item.sourceId ? bySource.get(item.sourceId) : undefined;
  const source = matches?.filter((entry) => !item.type || entry.type === item.type);
  if (source?.length === 1) return source[0].art;
  // A known but unresolved identity should not silently select another item by name.
  if (item.sourceId && item.sourceId !== item.name) return undefined;
  const name = normalize(item.name);
  const candidates = byName.get(name)?.filter((entry) => !item.type || entry.type === item.type);
  // Bonus illustrations must not make an otherwise unique catalog name ambiguous.
  const catalog = candidates?.filter((entry) => entry.type !== "bonus");
  const named = catalog?.length ? catalog : candidates;
  if (named?.length === 1) return named[0].art;
  const bonus = bonusAliases.get(name);
  return bonus ? byId.get(bonus)?.art : undefined;
}
