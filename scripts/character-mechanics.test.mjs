import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

const root = process.cwd();
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const target = path.join(root, specifier.slice(2));
      return nextResolve(pathToFileURL(/\.[a-z0-9]+$/i.test(target) ? target : target + ".ts").href, context);
    }
    if (specifier.startsWith("./") && !specifier.match(/\.[a-z0-9]+$/i)) {
      try { return nextResolve(specifier + ".ts", context); } catch { return nextResolve(specifier, context); }
    }
    return nextResolve(specifier, context);
  },
});

const game = await import("../lib/game.ts");
const rules = await import("../lib/daggerheartCharacter.ts");

test("level derives tier, baseline proficiency, armor thresholds and evasion", () => {
  assert.deepEqual([1, 2, 4, 5, 7, 8, 10].map(rules.daggerheartTierForLevel), [1, 2, 2, 3, 3, 4, 4]);
  assert.deepEqual([1, 2, 5, 8].map(rules.baseProficiencyForLevel), [1, 2, 3, 4]);
  assert.deepEqual(rules.thresholdsFromEquipment([{ name: "Gibão", detail: "Limiares 5/11 · Armadura 3 · Flexível (+1 Evasão)" }], 1), { major: 6, severe: 12 });
  assert.deepEqual(rules.thresholdsFromEquipment([{ name: "Armadura de Couro", detail: "Limiares 6/13 · Armadura 3" }], 5), { major: 11, severe: 18 });
  assert.deepEqual(rules.thresholdsFromEquipment([{ name: "Cota de Malha", detail: "Limiares 7/15 · Armadura 4 · Pesada" }], 1), { major: 8, severe: 16 });
  assert.equal(rules.equipmentEvasionBonus([{ name: "Gibão", detail: "Flexível (+1 Evasão)" }]), 1);
  assert.equal(rules.equipmentEvasionBonus([{ name: "Cota de Malha", detail: "Pesada" }]), -1);
});

test("legacy remaining HP migrates once into marked HP and stays stable", () => {
  const state = structuredClone(game.initialState);
  delete state.resourceModelVersion;
  state.character.hp = 5;
  state.character.maxHp = 7;
  const migrated = game.ensureGameStateCharacterModel(state);
  assert.equal(migrated.character.hp, 2);
  assert.equal(migrated.resourceModelVersion, 2);
  assert.strictEqual(game.ensureGameStateCharacterModel(migrated), migrated);
});

test("marked HP reaches the death choice at max and healing clears unconscious", () => {
  const state = structuredClone(game.initialState);
  state.character.hp = state.character.maxHp - 1;
  state.character.death = undefined;
  let next = game.executeCommand(state, { type: "adjust", resource: "hp", amount: 1 });
  assert.equal(next.character.hp, next.character.maxHp);
  assert.equal(next.character.death?.status, "choice");
  next.character.conditions = ["Inconsciente"];
  next = game.executeCommand(next, { type: "adjust", resource: "hp", amount: -1 });
  assert.equal(next.character.conditions.includes("Inconsciente"), false);
});

test("Avoid Death rolls the Hope die and a low result creates a scar and Hope-slot loss", () => {
  const state = structuredClone(game.initialState);
  state.character.level = 5;
  state.character.hp = state.character.maxHp;
  state.character.death = { status: "choice" };
  const waiting = game.chooseDeathMove(state, "avoid");
  assert.equal(waiting.pendingRoll?.purpose, "death-avoid");
  const resolved = game.resolvePendingRoll(waiting, waiting.pendingRoll.id, {
    formula: "1d12",
    total: 4,
    dice: [{ die: "d12", value: 4, label: "Esperança" }],
  });
  assert.equal(resolved.character.scars, 1);
  assert.equal(resolved.character.maxHope, state.character.maxHope - 1);
  assert.equal(resolved.character.conditions.includes("Inconsciente"), true);
  assert.equal(resolved.character.death?.status, "resolved");
});

test("Risk It All lets Hope recovery be split point by point", () => {
  const state = structuredClone(game.initialState);
  state.character.hp = state.character.maxHp;
  state.character.stress = 2;
  state.character.death = { status: "choice" };
  const waiting = game.chooseDeathMove(state, "risk");
  const resolved = game.resolvePendingRoll(waiting, waiting.pendingRoll.id, {
    formula: "2d12",
    total: 11,
    dice: [
      { die: "d12", value: 8, label: "Esperança" },
      { die: "d12", value: 3, label: "Medo" },
    ],
  });
  assert.equal(resolved.character.death?.status, "risk-recovery");
  assert.equal(resolved.character.death?.recoveryPoints, 8);
  const hp = game.spendDeathRecoveryPoint(resolved, "hp");
  assert.equal(hp.character.hp, resolved.character.hp - 1);
  const stress = game.spendDeathRecoveryPoint(hp, "stress");
  assert.equal(stress.character.stress, resolved.character.stress - 1);
  assert.equal(stress.character.death?.recoveryPoints, 6);
});

test("Druid transformation changes effective sheet values without mutating base traits and fully reverts", () => {
  const state = structuredClone(game.initialState);
  state.character.daggerheart = {
    ...state.character.daggerheart,
    traits: { agility: 1, strength: 0, finesse: 2, instinct: 1, presence: -1, knowledge: 0 },
  };
  const transformed = game.executeCommand(state, {
    type: "transformation",
    transformation: { kind: "beastform", name: "Predador Ágil", evasionBonus: 2, traitOverrides: { agility: 3, strength: 2 } },
  });
  assert.equal(transformed.character.daggerheart.traits.agility, 1);
  assert.equal(rules.effectiveCharacterTraits(transformed.character).agility, 3);
  assert.equal(rules.effectiveCharacterEvasion(transformed.character), state.character.evasion + 2);
  const reverted = game.executeCommand(transformed, { type: "transformation", transformation: undefined });
  assert.equal(reverted.character.daggerheart.transformation, undefined);
  assert.equal(rules.effectiveCharacterTraits(reverted.character).agility, 1);
  assert.equal(rules.effectiveCharacterEvasion(reverted.character), state.character.evasion);
});

test("Summoner circle trackers share the level-wide entity cap", () => {
  const trackers = rules.initialTrackersForCharacter("Summoner", 3, "Necromancy");
  const state = structuredClone(game.initialState);
  state.character.daggerheart = { ...state.character.daggerheart, trackers };
  let next = game.executeCommand(state, { type: "tracker", trackerId: "summoner-circle-1", value: 2, mode: "adjust" });
  next = game.executeCommand(next, { type: "tracker", trackerId: "summoner-circle-2", value: 2, mode: "adjust" });
  const total = next.character.daggerheart.trackers.find((tracker) => tracker.id === "summoner-total");
  const first = next.character.daggerheart.trackers.find((tracker) => tracker.id === "summoner-circle-1");
  const second = next.character.daggerheart.trackers.find((tracker) => tracker.id === "summoner-circle-2");
  assert.equal(total.value, 3);
  assert.equal(first.value, 2);
  assert.equal(second.value, 1);
});
