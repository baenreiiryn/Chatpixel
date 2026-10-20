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

test("legacy campaigns derive a player timeline without secret or visual memories", () => {
  const state = structuredClone(game.initialState);
  delete state.timeline;
  state.memories = [
    { id: "fact", kind: "fact", text: "O portão usa uma chave lunar.", createdAt: "2026-01-01T00:00:00.000Z", campaignMinute: 10 },
    { id: "secret", kind: "secret", text: "O rei é um impostor.", createdAt: "2026-01-01T00:00:01.000Z", campaignMinute: 11 },
    { id: "visual", kind: "visual", text: "A capa é vermelha.", createdAt: "2026-01-01T00:00:02.000Z", campaignMinute: 12 },
    { id: "event", kind: "event", text: "A ponte desabou durante a fuga.", createdAt: "2026-01-01T00:00:03.000Z", campaignMinute: 13 },
    { id: "later-fact", kind: "fact", text: "O símbolo pertence à Ordem das Cinzas.", createdAt: "2026-01-01T00:00:04.000Z", campaignMinute: 14 },
  ];
  const migrated = game.ensureGameStateTimeline(state);
  assert.equal(migrated.timeline.length, 2);
  assert.deepEqual(migrated.timeline.map((entry) => entry.memoryId), ["event", "later-fact"]);
  assert.ok(migrated.timeline.every((entry) => entry.visibility === "public"));
});

test("GM timeline entries use the current campaign minute and are idempotent", () => {
  const state = structuredClone(game.initialState);
  state.timeline = [];
  const args = JSON.stringify({
    title: "O símbolo foi decifrado",
    description: "O grupo descobriu que o símbolo pertence à Ordem das Cinzas.",
    kind: "discovery",
    tags: ["Ordem", "Pista", "Pista"],
    importance: "major",
  });
  const first = gm.executeGmTool(state, "timeline_entry_add", args);
  assert.equal(first.result.ok, true);
  assert.equal(first.state.timeline.length, 1);
  assert.equal(first.state.timeline[0].campaignMinute, state.time.campaignMinute);
  assert.deepEqual(first.state.timeline[0].tags, ["Ordem", "Pista"]);
  const second = gm.executeGmTool(first.state, "timeline_entry_add", args);
  assert.equal(second.result.duplicate, true);
  assert.equal(second.state.timeline.length, 1);
});

test("timeline rejects future history and can reveal a hidden entry", () => {
  const state = structuredClone(game.initialState);
  state.timeline = [];
  const future = gm.executeGmTool(state, "timeline_entry_add", JSON.stringify({
    title: "A guerra começa",
    description: "Um fato que ainda não aconteceu.",
    kind: "world",
    campaignMinute: state.time.campaignMinute + 1,
  }));
  assert.equal(future.result.ok, false);

  const hidden = gm.executeGmTool(state, "timeline_entry_add", JSON.stringify({
    title: "O herdeiro sobreviveu",
    description: "A verdade foi registrada antes de ser revelada.",
    kind: "world",
    visibility: "hidden",
  }));
  const entryId = hidden.state.timeline[0].id;
  assert.equal(hidden.state.timeline[0].visibility, "hidden");
  const revealed = gm.executeGmTool(hidden.state, "timeline_entry_set_visibility", JSON.stringify({ entryId, visibility: "public" }));
  assert.equal(revealed.result.ok, true);
  assert.equal(revealed.state.timeline[0].visibility, "public");
});

test("memory_record no longer duplicates identical persistent memory", () => {
  const state = structuredClone(game.initialState);
  state.memories = [];
  const args = JSON.stringify({ kind: "fact", text: "A torre pertence a Arven." });
  const first = gm.executeGmTool(state, "memory_record", args);
  const second = gm.executeGmTool(first.state, "memory_record", args);
  assert.equal(first.state.memories.length, 1);
  assert.equal(second.state.memories.length, 1);
  assert.equal(second.result.duplicate, true);
});
