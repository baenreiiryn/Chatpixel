export const EQUIPMENT_RARITIES = ["common", "uncommon", "rare", "very-rare", "legendary"] as const;
export type EquipmentRarity = typeof EQUIPMENT_RARITIES[number];
export function equipmentRarityLabel(rarity?: string) {
  return ({common: "Comum", uncommon: "Incomum", rare: "Raro", "very-rare": "Muito raro", legendary: "Lendário"} as Record<string, string>)[rarity || ""] || "Sem classificação";
}
