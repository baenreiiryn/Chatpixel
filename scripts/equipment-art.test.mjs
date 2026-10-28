import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import manifest from "../lib/compendium/equipment-art.manifest.json" with { type: "json" };
import compendium from "../lib/compendium/daggerheart.generated.json" with { type: "json" };
import { resolveEquipmentArt } from "../lib/equipmentArt.ts";
import { startingLoadoutInventory } from "../lib/startingEquipment.ts";

test("all 365 equipment entries use their own ID-matched artwork and all 368 original files are intact", () => {
  const equipment = compendium.entries.filter((item) => item.category === "equipment");
  assert.equal(equipment.length, 365);
  assert.equal(manifest.entries.length, 368);
  const index = new Map(manifest.entries.map((item) => [item.id, item]));
  assert.equal(index.size, 368);
  for (const entry of equipment) {
    const artwork = index.get(entry.id);
    assert.ok(artwork, entry.id);
    assert.equal(artwork.sourceId, entry.sourceId, entry.id);
    assert.equal(artwork.type, entry.type, entry.id);
    assert.equal(entry.art, artwork.art, entry.id);
  }
  for (const item of manifest.entries) {
    const bytes = fs.readFileSync(path.resolve("public", "." + item.art));
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF", item.id);
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP", item.id);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256, item.id);
  }
});

test("translated variants with identical names keep distinct artwork by ID and source ID", () => {
  const variants = manifest.entries.filter((entry) => entry.name === "Adaga Pequena Aprimorada");
  assert.equal(variants.length, 2);
  assert.notEqual(variants[0].art, variants[1].art);
  for (const item of variants) {
    assert.equal(resolveEquipmentArt({name: item.name, id: item.id}), item.art);
    assert.equal(resolveEquipmentArt({name: item.name, sourceId: item.sourceId}), item.art);
  }
  assert.equal(resolveEquipmentArt({name: variants[0].name}), undefined);
  assert.equal(resolveEquipmentArt({name: variants[0].name, sourceId: "custom-unknown"}), undefined);
});

test("existing inventory resolves unique names and all basic supplies without overriding custom items", () => {
  for (const [name, id] of [["Tocha", "bonus-torch"], ["Corda", "bonus-rope"], ["Corda de 15 Metros", "void-unofficial-loot-50ft-of-rope"], ["Suprimentos básicos", "bonus-basic-supplies"]]) {
    assert.equal(resolveEquipmentArt({name}), manifest.entries.find((item) => item.id === id).art);
  }
  assert.equal(resolveEquipmentArt({name: "Um item personalizado"}), undefined);
});

test("choosing starting equipment retains the exact artwork in the saved inventory", () => {
  const entry = compendium.entries.find((item) => item.category === "equipment" && item.type === "weapon" && item.weaponSlot === "primary" && item.rarity === "common" && !item.creationRestricted);
  const [saved] = startingLoadoutInventory({primary: entry.id}, compendium.entries, 1);
  assert.equal(saved.sourceId, entry.sourceId);
  assert.equal(saved.art, entry.art);
  assert.equal(resolveEquipmentArt(saved), entry.art);
});
