import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const generatedPath = path.join(root, "lib", "compendium", "daggerheart.generated.json");

test("importer links every existing subclass feature to its subclass and progression tier", () => {
  const imported = spawnSync(process.execPath, ["scripts/import-daggerheart-compendium.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(imported.status, 0, imported.stderr || imported.stdout);

  const payload = JSON.parse(fs.readFileSync(generatedPath, "utf8"));
  const features = payload.entries.filter((entry) => entry.type === "subclassFeature");
  const core = features.filter((entry) => entry.source === "core");

  assert.equal(core.length, 75);
  assert.equal(core.filter((entry) => entry.tier === "foundation").length, 27);
  assert.equal(core.filter((entry) => entry.tier === "specialization").length, 24);
  assert.equal(core.filter((entry) => entry.tier === "mastery").length, 24);
  assert.equal(features.filter((entry) => !entry.parent).length, 0);
  assert.equal(features.filter((entry) => !entry.tier).length, 0);

  const expectFeature = (sourceId, parent, tier) => {
    const feature = features.find((entry) => entry.sourceId === sourceId && entry.parent === parent);
    assert.ok(feature, `${sourceId} was not linked to ${parent}`);
    assert.equal(feature.tier, tier, `${sourceId} has wrong tier`);
  };

  expectFeature("Gifted Performer", "Troubadour", "foundation");
  expectFeature("Maestro", "Troubadour", "specialization");
  expectFeature("Virtuoso", "Troubadour", "mastery");
  expectFeature("Elemental Origin", "Elementalist", "foundation");
  expectFeature("Conjure Shield", "School Of War", "specialization");
  expectFeature("Have No Fear", "School Of War", "mastery");
  expectFeature("Shadowed Grit", "Order of the Specter", "foundation");
  expectFeature("Veilwalker", "Order of the Specter", "foundation");
  expectFeature("Veilstalker", "Order of the Specter", "specialization");
  expectFeature("Spectral Form", "Order of the Specter", "mastery");
  expectFeature("Horror Honed", "Order of the Specter", "mastery");
  expectFeature("Favored Weapon", "Pact of the Wrathful", "foundation");
  expectFeature("Menacing Reach", "Pact of the Wrathful", "specialization");
  expectFeature("Divine Ire", "Pact of the Wrathful", "mastery");
});

test("character creation requests foundation subclass features by default", () => {
  const source = fs.readFileSync(path.join(root, "lib", "characterCreation", "daggerheart.ts"), "utf8");
  assert.match(source, /subclassFeaturesFor\(subclassId: string, tier: SubclassFeatureTier \| "all" = "foundation"\)/);
  assert.match(source, /tier === "all" \|\| entry\.tier === tier/);
});
