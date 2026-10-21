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

test("campaign opening prompt starts the fiction before any player action and requires a concrete scene", () => {
  const state = structuredClone(game.initialState);
  state.messages = [];
  state.campaign.tone = "Fantasia sombria";
  state.campaign.adventureHook = "Sinos enterrados voltaram a tocar sob a cidade.";
  const prompt = gm.buildCampaignOpeningPrompt(state, "creation");
  assert.match(prompt, /ABERTURA AUTOMÁTICA DA CAMPANHA/);
  assert.match(prompt, /scene_set/);
  assert.match(prompt, /ainda não realizou nenhuma ação/i);
  assert.match(prompt, /história|gancho|companheiros/i);
  assert.match(prompt, /não.*rolagem/i);
});

test("restart begins with no old narration or scene image so the GM can create a fresh opening", () => {
  const state = structuredClone(game.initialState);
  state.sceneVisual = {
    scene: state.campaign.scene,
    query: "old scene",
    imageUrl: "https://images.example.test/old.jpg",
    sourceUrl: "https://example.test/old",
    searchedAt: "2026-10-21T00:00:00.000Z",
  };
  const restarted = game.restartCampaignFromSnapshot(state);
  assert.deepEqual(restarted.messages, []);
  assert.equal(restarted.sceneVisual, undefined);
  assert.equal(restarted.campaign.session, 1);
  assert.equal(restarted.campaign.scene, "Prólogo · Cena inicial");
});

test("restart opening prompt never refers to the previous run as canon", () => {
  const prompt = gm.buildCampaignOpeningPrompt(structuredClone(game.initialState), "restart");
  assert.match(prompt, /novo início/i);
  assert.match(prompt, /não mencione.*reinici/i);
});
