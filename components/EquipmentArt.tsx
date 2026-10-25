"use client";

import CompendiumArt from "@/components/CompendiumArt";
import { resolveCraftingItemIcon } from "@/lib/craftingItemIcons";
import { resolveEquipmentArt, type EquipmentArtIdentity } from "@/lib/equipmentArt";

export default function EquipmentArt({item, className = ""}: {item: EquipmentArtIdentity & {description?: string; detail?: string; art?: string | null; icon?: string}; className?: string}) {
  const resolved = resolveCraftingItemIcon(item.name);
  const generic = item.type === "armor" ? "/crafting-item-icons/armor.svg" : item.type === "weapon" ? "/crafting-item-icons/sword.svg" : item.type === "consumable" ? "/crafting-item-icons/potion.svg" : null;
  const art = item.art || resolveEquipmentArt(item) || (resolved.id !== "material" ? resolved.path : generic);
  return art
    ? <CompendiumArt entry={{art, name: item.name, type: item.type || "loot", category: "equipment"}} className={className} alt="" fallback={<span className="equipmentArtFallback">{item.icon || "◇"}</span>} />
    : <span className="equipmentArtFallback" aria-hidden="true">{item.icon || "◇"}</span>;
}
