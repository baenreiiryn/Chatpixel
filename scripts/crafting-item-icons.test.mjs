import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const root = process.cwd();
const modulePath = path.join(root, "lib", "craftingItemIcons.ts");

async function loadIcons() {
  assert.equal(existsSync(modulePath), true, "lib/craftingItemIcons.ts must exist");
  return import(pathToFileURL(modulePath).href);
}

test("crafting icon catalog covers the requested item families and every SVG path exists", async () => {
  const { CRAFTING_ITEM_ICONS } = await loadIcons();
  const requiredIds = [
    "sword", "shield", "armor", "helmet", "bow", "axe", "hammer", "tool",
    "potion", "poison", "vial", "herb", "mushroom", "ore", "metal", "gem",
    "crystal", "ring", "necklace", "scroll", "book", "bone", "fang", "tooth",
    "claw", "paw", "tail", "wing", "horn", "scale", "feather", "hide", "meat",
    "fish", "coin", "material",
  ];

  assert.deepEqual(Object.keys(CRAFTING_ITEM_ICONS).sort(), requiredIds.sort());
  for (const [id, icon] of Object.entries(CRAFTING_ITEM_ICONS)) {
    assert.match(icon.path, /^\/crafting-item-icons\/[a-z0-9-]+\.svg$/);
    const filePath = path.join(root, "public", icon.path.slice(1));
    assert.equal(existsSync(filePath), true, `${id} points to missing ${filePath}`);
    const svg = readFileSync(filePath, "utf8");
    assert.match(svg, /^<svg\b/);
    assert.doesNotMatch(svg, /<path d="M0 0h512v512H0z"\s*\/>/, `${id} must keep a transparent background`);
  }
});

test("resolver recognizes representative PT-BR and English names/details", async () => {
  const { resolveCraftingItemIconId, resolveCraftingItemIconPath } = await loadIcons();
  const cases = [
    ["Espada Longa", "", "sword"],
    ["Longsword", "", "sword"],
    ["Poção de Cura", "Frasco alquímico", "potion"],
    ["Veneno de Serpente", "Poison for a blade", "poison"],
    ["Lingote de Ferro", "Metal de forja", "metal"],
    ["Minério de prata", "Pedra bruta", "ore"],
    ["Presa de Lobo", "", "fang"],
    ["Wolf Fang", "", "fang"],
    ["Couro de Urso", "Pele curtida", "hide"],
    ["Asa de Fada", "Componente feérico", "wing"],
    ["Pergaminho Arcano", "Spell scroll", "scroll"],
    ["Cristal Lunar", "Gema azul", "crystal"],
    ["Sucata estranha", "Material de crafting sem categoria", "material"],
  ];

  for (const [name, detail, expected] of cases) {
    assert.equal(resolveCraftingItemIconId(name, detail), expected, `${name} / ${detail}`);
    assert.equal(resolveCraftingItemIconPath(name, detail), `/crafting-item-icons/${expected}.svg`);
  }
});

test("specific item words beat generic material/detail hints", async () => {
  const { resolveCraftingItemIconId } = await loadIcons();
  assert.equal(resolveCraftingItemIconId("Armadura de Ferro", "Material metálico"), "armor");
  assert.equal(resolveCraftingItemIconId("Anel de Prata", "Joia de metal"), "ring");
  assert.equal(resolveCraftingItemIconId("Frasco de Veneno", "Reagente alquímico"), "poison");
  assert.equal(resolveCraftingItemIconId("Pena de Grifo", "Material raro"), "feather");
});
