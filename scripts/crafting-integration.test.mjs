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
      const withExtension = /\.[a-z0-9]+$/i.test(target) ? target : target + ".ts";
      return nextResolve(pathToFileURL(withExtension).href, context);
    }
    if (specifier.startsWith("./") && !specifier.match(/\.[a-z0-9]+$/i)) {
      try {
        return nextResolve(specifier + ".ts", context);
      } catch {
        return nextResolve(specifier, context);
      }
    }
    return nextResolve(specifier, context);
  },
});

const game = await import("../lib/game.ts");
const gm = await import("../lib/gm.ts");
const tools = await import("../lib/tools.ts");
const crafting = await import("../lib/crafting.ts");

test("legacy campaigns receive zeroed crafting state and restart snapshots preserve it", () => {
  assert.equal(typeof game.ensureGameStateCrafting, "function");
  const legacy = structuredClone(game.initialState);
  delete legacy.crafting;
  const migrated = game.ensureGameStateCrafting(legacy);
  assert.equal(migrated.crafting.progress.mundane.xp, 0);
  assert.equal(migrated.crafting.progress.enchantment.xp, 0);
  assert.equal(migrated.crafting.progress.alchemy.xp, 0);

  migrated.crafting.progress.alchemy.xp = 450;
  const snapshot = game.createCampaignRestartSnapshot(migrated);
  assert.equal(snapshot.crafting.progress.alchemy.xp, 450);
  migrated.campaign.restartSnapshot = snapshot;
  migrated.crafting.progress.alchemy.xp = 999;
  const restarted = game.restartCampaignFromSnapshot(migrated);
  assert.equal(restarted.crafting.progress.alchemy.xp, 450);
});

test("GM surface exposes dedicated crafting tools", () => {
  const names = new Set(tools.oracleTools.map((tool) => tool.name));
  for (const name of ["craft_recipe_learn", "craft_request_roll", "craft_reject_attempt", "craft_award_xp"]) {
    assert.equal(names.has(name), true, `missing ${name}`);
  }
});

test("crafting state is included in the GM context packet", () => {
  assert.equal(typeof game.ensureGameStateCrafting, "function");
  const state = game.ensureGameStateCrafting(structuredClone(game.initialState));
  const context = game.buildContextPacket(state);
  assert.ok(context.crafting);
  assert.deepEqual(Object.keys(context.crafting.progress).sort(), ["alchemy", "enchantment", "mundane"]);
});

test("GM rejects a crafting attempt cleanly through the dedicated tool", () => {
  assert.equal(typeof game.ensureGameStateCrafting, "function");
  const state = game.ensureGameStateCrafting(structuredClone(game.initialState));
  state.crafting.pendingAttempt = {
    id: "attempt-1",
    discipline: "mundane",
    ingredients: [{ slot: 0, itemId: state.inventory[0].id, itemName: state.inventory[0].name, quantity: 1 }],
    stage: "review",
    requestedAt: "2026-10-21T00:00:00.000Z",
  };
  const result = gm.executeGmTool(state, "craft_reject_attempt", JSON.stringify({ reason: "A combinação não forma um objeto coerente." }));
  assert.equal(result.result.ok, true);
  assert.equal(result.state.crafting.pendingAttempt, undefined);
});

test("discovery tool learns the pending grid recipe and craft_request_roll binds the computed roll", () => {
  let state = game.ensureGameStateCrafting(structuredClone(game.initialState));
  const material = state.inventory[0];
  state.crafting = crafting.beginCraftAttempt(state.crafting, state.inventory, {
    id: "attempt-discovery",
    discipline: "mundane",
    ingredients: [{ slot: 4, itemId: material.id, itemName: material.name, quantity: 1 }],
    requestedAt: "2026-10-21T00:00:00.000Z",
  }).crafting;

  const learned = gm.executeGmTool(state, "craft_recipe_learn", JSON.stringify({
    name: "Talismã Lunar",
    discipline: "mundane",
    layout: "shaped",
    learnedFrom: "discovery",
    fromPendingAttempt: true,
    result: {
      name: "Talismã Lunar",
      detail: "Um pequeno talismã feito a partir da Chave Lunar.",
      icon: "✦",
      rarity: "common",
      quantity: 1,
    },
  }));
  assert.equal(learned.result.ok, true);
  assert.equal(learned.state.crafting.recipes.length, 1);
  assert.equal(learned.state.crafting.progress.mundane.xp, 20);
  const recipeId = learned.state.crafting.recipes[0].id;
  assert.equal(learned.state.crafting.pendingAttempt.recipeId, recipeId);

  const requested = gm.executeGmTool(learned.state, "craft_request_roll", JSON.stringify({ recipeId }));
  assert.equal(requested.result.ok, true);
  assert.equal(requested.result.dc, 14);
  assert.equal(requested.result.successChance, 50);
  assert.equal(requested.state.pendingRoll.rollKind, "duality");
  assert.equal(requested.state.pendingRoll.formula, "2d12");
  assert.equal(requested.state.crafting.pendingAttempt.stage, "awaiting-roll");
  assert.equal(requested.state.crafting.pendingAttempt.pendingRollId, requested.state.pendingRoll.id);
});

test("teacher XP tool advances only the requested discipline", () => {
  const state = game.ensureGameStateCrafting(structuredClone(game.initialState));
  const result = gm.executeGmTool(state, "craft_award_xp", JSON.stringify({
    discipline: "alchemy",
    amount: 100,
    reason: "Treino prático com a alquimista da guilda.",
  }));
  assert.equal(result.result.ok, true);
  assert.equal(result.state.crafting.progress.alchemy.xp, 100);
  assert.equal(result.state.crafting.progress.mundane.xp, 0);
  assert.equal(result.result.level, 1);
});

test("pending-grid recipe discovery cannot be mislabeled as teacher knowledge", () => {
  let state = game.ensureGameStateCrafting(structuredClone(game.initialState));
  const material = state.inventory[0];
  state.crafting = crafting.beginCraftAttempt(state.crafting, state.inventory, {
    id: "attempt-origin-guard",
    discipline: "mundane",
    ingredients: [{ slot: 0, itemId: material.id, itemName: material.name, quantity: 1 }],
    requestedAt: "2026-10-21T00:00:00.000Z",
  }).crafting;
  const result = gm.executeGmTool(state, "craft_recipe_learn", JSON.stringify({
    name: "Receita indevida",
    discipline: "mundane",
    layout: "shaped",
    learnedFrom: "teacher",
    fromPendingAttempt: true,
    result: { name: "Receita indevida", detail: "", icon: "✦", rarity: "common", quantity: 1 },
  }));
  assert.equal(result.result.ok, false);
  assert.match(result.result.error, /discovery|descobert/i);
  assert.equal(result.state.crafting.recipes.length, 0);
});
