import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const payload = JSON.parse(fs.readFileSync(path.join(root, "lib", "compendium", "daggerheart.generated.json"), "utf8"));
const entries = payload.entries;

test("all playable classes use the local class icon set", () => {
  const expected = new Map([
    ["Bard", "bardo.webp"], ["Druid", "druida.webp"], ["Guardian", "guardiao.webp"],
    ["Ranger", "patrulheiro.webp"], ["Rogue", "ladino.webp"], ["Seraph", "serafim.webp"],
    ["Sorcerer", "feiticeiro.webp"], ["Warrior", "guerreiro.webp"], ["Wizard", "mago.webp"],
    ["Assassin", "assassino.webp"], ["Brawler", "pugilista.webp"], ["Warlock", "ocultista.webp"],
    ["Witch", "bruxo.webp"], ["Blood Hunter", "cacador-de-sangue.webp"], ["Summoner", "invocador.webp"],
  ]);
  for (const [sourceId, file] of expected) {
    const entry = entries.find((candidate) => candidate.type === "class" && candidate.sourceId === sourceId);
    assert.ok(entry, `${sourceId} class entry is missing`);
    assert.equal(entry.art, `/compendium/daggerheart/classes/${file}`);
    assert.equal(fs.existsSync(path.join(root, "public", entry.art.slice(1))), true, `${file} is missing`);
  }
});

test("the current Void 1.5 content replaces stale Blood Hunter records and adds Summoner", () => {
  const voidEntries = entries.filter((entry) => entry.source === "void-unofficial");
  assert.equal(voidEntries.length, 48);
  assert.ok(voidEntries.some((entry) => entry.type === "class" && entry.sourceId === "Summoner" && entry.name === "Invocador"));
  assert.ok(voidEntries.some((entry) => entry.type === "subclass" && entry.sourceId === "Necromancy" && entry.parent === "Summoner"));
  assert.ok(voidEntries.some((entry) => entry.type === "subclass" && entry.sourceId === "Theurgy" && entry.parent === "Summoner"));
  assert.ok(voidEntries.some((entry) => entry.type === "subclass" && entry.sourceId === "Order of the Specter" && entry.parent === "Blood Hunter"));

  for (const stale of [
    "Order of the Ghost Slayer", "Chasing Death", "Werewolf", "Control the Beast",
    "Vitality Manipulation", "Burning Blood", "Mutual Suffering", "Life Leash",
    "Runic Adrenaline", "Bloodbath", "Glyph of Hermorrhaging", "Crimson Adamance",
  ]) {
    assert.equal(entries.some((entry) => entry.sourceId === stale), false, `${stale} should have been replaced`);
  }
});

test("Void Blood domain cards keep their current level and recall metadata", () => {
  const expected = new Map([
    ["Palpitations", [2, 2]], ["Burning Gore", [3, 3]], ["Viscous Form", [5, 1]],
    ["Life Link", [6, 0]], ["Bleeding Tree", [7, 2]], ["Glyph of Hemorrhaging", [8, 2]],
    ["Ichor Wave", [9, 3]], ["Scabrous Adamance", [10, 1]],
  ]);
  for (const [sourceId, [level, recallCost]] of expected) {
    const entry = entries.find((candidate) => candidate.source === "void-unofficial" && candidate.sourceId === sourceId);
    assert.ok(entry, `${sourceId} is missing`);
    assert.equal(entry.type, "domainCard");
    assert.equal(entry.domain, "Blood");
    assert.equal(entry.level, level);
    assert.equal(entry.recallCost, recallCost);
  }
});
