import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const creationSource = fs.readFileSync("lib/characterCreation/daggerheart.ts", "utf8");
const compendium = JSON.parse(fs.readFileSync("lib/compendium/daggerheart.generated.json", "utf8"));

const canonicalByType = {
  weapon: new Set(compendium.entries.filter((entry) => entry.type === "weapon").map((entry) => entry.name)),
  armor: new Set(compendium.entries.filter((entry) => entry.type === "armor").map((entry) => entry.name)),
};

function suggestedCalls(kind) {
  return [...creationSource.matchAll(new RegExp(`\\b${kind}\\(\\"([^\\"]+)\\"`, "g"))]
    .map((match) => match[1]);
}

test("class suggested weapons and armor use canonical compendium names", () => {
  for (const name of suggestedCalls("weapon")) {
    assert.ok(canonicalByType.weapon.has(name), `Suggested weapon is not canonical: ${name}`);
  }
  for (const name of suggestedCalls("armor")) {
    assert.ok(canonicalByType.armor.has(name), `Suggested armor is not canonical: ${name}`);
  }
});

test("legacy abbreviated equipment names are not used in class presets", () => {
  for (const oldName of ["Couro", "Gambesão", "Bastão curto", "Bastão duplo", "Bastão"]) {
    assert.equal(creationSource.includes(`\"${oldName}\"`), false, `Legacy equipment name still present: ${oldName}`);
  }
  assert.ok(creationSource.includes('armor("Armadura de Couro"'));
  assert.ok(creationSource.includes('armor("Gibão"'));
  assert.ok(creationSource.includes('weapon("Cajado Curto"'));
  assert.ok(creationSource.includes('weapon("Cajado Duplo"'));
  assert.ok(creationSource.includes('weapon("Bordão"'));
});

test("preset equipment resolves compendium source ids instead of creating anonymous weapon/armor items", () => {
  assert.match(creationSource, /candidate\.type === type && candidate\.name === name/);
  assert.match(creationSource, /sourceId: entry\.sourceId/);
});
