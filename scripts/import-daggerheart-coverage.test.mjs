import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { before, test } from "node:test";

let entries;
before(() => {
  const result = spawnSync(process.execPath, ["scripts/import-daggerheart-compendium.mjs"], { cwd: process.cwd(), encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  entries = JSON.parse(fs.readFileSync("lib/compendium/daggerheart.generated.json", "utf8")).entries;
});

test("Freeborne grants Unbound and Reborne grants Found Family", () => {
  for (const [parent, sourceId] of [["Freeborne", "Unbound"], ["Reborne", "Found Family"]]) {
    assert.deepEqual(entries.filter((entry) => entry.type === "communityFeature" && entry.parent === parent).map((entry) => entry.sourceId), [sourceId]);
  }
});

const expected = {
  "Martial Artist": { foundation: ["Stance Fighter"], specialization: ["Keen Defenses", "Focus Cannon"], mastery: ["Limit Breaker", "Flow State"] },
  Hedge: { foundation: ["Herbal Remedies", "Enchanted Talisman"], specialization: ["Walk Between Worlds", "Vexing Malison"], mastery: ["Circle of Power"] },
  "Executioners Guild": { foundation: ["First Strike", "Ambush"], specialization: ["Death Strike", "Scorpion's Poise"], mastery: ["True Strike", "Backstab"] },
  Juggernaut: { foundation: ["Rugged", "Overwhelm"], specialization: ["Surrounded", "Eye for an Eye"], mastery: ["Pummeljoy", "Not Done Yet"] },
  "Poisoners Guild": { foundation: ["Toxic Concoctions"], specialization: ["Poison Compendium", "Twin Fang"], mastery: ["Venomancer", "Adder's Blessing"] },
  Moon: { foundation: ["Night's Glamour"], specialization: ["Moonbeam", "Ire of Pale Light"], mastery: ["Lunar Phases"] },
};

for (const [parent, tiers] of Object.entries(expected)) {
  test(parent + " has all foundation, specialization and mastery features", () => {
    for (const [tier, names] of Object.entries(tiers)) {
      const features = entries.filter((entry) => entry.type === "subclassFeature" && entry.parent === parent && entry.tier === tier);
      assert.deepEqual(features.map((entry) => entry.sourceId).sort(), names.toSorted());
      for (const feature of features) {
        assert.ok(feature.description.trim().length > 20, feature.name);
        assert.ok(fs.existsSync("public" + feature.art), feature.name + " missing artwork");
      }
    }
  });
}

test("every playable subclass can supply all three progression cards", () => {
  for (const parent of entries.filter((entry) => entry.type === "subclass")) {
    for (const tier of ["foundation", "specialization", "mastery"]) {
      assert.ok(entries.some((entry) => entry.type === "subclassFeature" && entry.parent === parent.sourceId && entry.tier === tier), parent.name + ": missing " + tier);
    }
  }
});

test("restored abilities preserve their dice, complete poison lists and lunar phases", () => {
  const feature = (id) => entries.find((entry) => entry.type === "subclassFeature" && entry.sourceId === id);
  assert.ok(feature("Focus Cannon")?.description.includes("d20+3"));
  assert.ok(feature("Toxic Concoctions")?.description.includes("1d4+1"));
  for (const poison of ["Pétala Fantasma", "Esporo Sepulcral", "Erva Sanguessuga"]) assert.ok(feature("Toxic Concoctions")?.description.includes(poison), poison);
  for (const phase of ["Nova", "Crescente", "Cheia", "Minguante"]) assert.ok(feature("Lunar Phases")?.description.includes(phase), phase);
  assert.ok(feature("Stance Fighter")?.description.includes("Patamar 4"));
  assert.ok(feature("Stance Fighter")?.description.includes("Foco"));
});
