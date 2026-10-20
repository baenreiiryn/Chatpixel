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
const timeline = await import("../lib/timeline.ts");

test("legacy campaigns no longer inject persistent memories directly into the timeline", () => {
  const state = structuredClone(game.initialState);
  delete state.timeline;
  delete state.timelineVersion;
  state.memories = [
    { id: "fact", kind: "fact", text: "O portão usa uma chave lunar.", createdAt: "2026-01-01T00:00:00.000Z", campaignMinute: 10 },
    { id: "secret", kind: "secret", text: "O rei é um impostor.", createdAt: "2026-01-01T00:00:01.000Z", campaignMinute: 11 },
    { id: "visual", kind: "visual", text: "A capa é vermelha.", createdAt: "2026-01-01T00:00:02.000Z", campaignMinute: 12 },
    { id: "event", kind: "event", text: "A ponte desabou durante a fuga.", createdAt: "2026-01-01T00:00:03.000Z", campaignMinute: 13 },
    { id: "later-fact", kind: "fact", text: "O símbolo pertence à Ordem das Cinzas.", createdAt: "2026-01-01T00:00:04.000Z", campaignMinute: 14 },
  ];
  const migrated = game.ensureGameStateTimeline(state);
  assert.deepEqual(migrated.timeline, []);
  assert.equal(migrated.timelineVersion, 1);
  assert.equal(game.timelineNeedsNarrativeSynthesis(migrated), true);
});

test("legacy generated timeline blocks are removed while real GM entries are preserved", () => {
  const state = structuredClone(game.initialState);
  delete state.timelineVersion;
  state.campaign.adventureHook = "A academia foi fundada décadas atrás. Hoje os alunos aguardam a prova final.";
  state.timeline = [
    {
      id: "legacy-memory",
      title: "Gancho inicial da aventura: A academia foi fundada décadas atrás",
      description: state.campaign.adventureHook,
      campaignMinute: state.time.campaignMinute,
      createdAt: "2026-01-01T00:00:00.000Z",
      kind: "milestone",
      tags: ["Acontecimento"],
      visibility: "public",
      importance: "normal",
      memoryId: "m-hook",
    },
    {
      id: "real",
      title: "O grupo encontrou a chave",
      description: "A chave foi encontrada sob o observatório.",
      campaignMinute: state.time.campaignMinute - 10,
      createdAt: "2026-01-01T00:05:00.000Z",
      kind: "discovery",
      tags: ["Chave"],
      visibility: "public",
      importance: "normal",
    },
    {
      id: "short-migrated",
      title: "A ponte desabou",
      description: "A ponte desabou durante a fuga.",
      campaignMinute: state.time.campaignMinute - 20,
      createdAt: "2026-01-01T00:04:00.000Z",
      kind: "milestone",
      tags: ["Acontecimento"],
      visibility: "public",
      importance: "normal",
      memoryId: "m-short",
    },
  ];
  const migrated = game.ensureGameStateTimeline(state);
  assert.deepEqual(game.timelineWithoutLegacyGeneratedEntries(migrated).map((entry) => entry.id), ["real", "short-migrated"]);
  assert.equal(migrated.timelineVersion, 1);
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

test("timeline synthesis creates separate atomic entries on the same inferred date", () => {
  const state = structuredClone(game.initialState);
  const current = timeline.timelineEntryWorldDate(state.time, {
    id: "current",
    title: "current",
    description: "current",
    campaignMinute: state.time.campaignMinute,
    createdAt: new Date().toISOString(),
    kind: "other",
    tags: [],
    visibility: "public",
    importance: "normal",
  });
  const oldYear = state.time.calendar.epochYear - 25;
  const text = JSON.stringify({ entries: [
    {
      title: "Laencio salvou o reino",
      description: "Laencio derrotou a criatura que ameaçava Tamore.",
      kind: "combat",
      year: oldYear,
      monthIndex: 0,
      day: 5,
      hour: 12,
      minute: 0,
      tags: ["Laencio", "Tamore"],
      importance: "major",
    },
    {
      title: "A Academia Deathlock foi fundada",
      description: "Após a vitória, Laencio fundou a academia de aventureiros.",
      kind: "world",
      year: oldYear,
      monthIndex: 0,
      day: 5,
      hour: 12,
      minute: 0,
      tags: ["Academia"],
      importance: "major",
    },
  ] });
  const entries = timeline.parseTimelineSynthesis(text, state.time, "2026-01-01T00:00:00.000Z");
  assert.equal(entries.length, 2);
  assert.equal(entries[0].worldDate.year, oldYear);
  assert.deepEqual(entries[0].worldDate, entries[1].worldDate);
  assert.notEqual(entries[0].title, entries[1].title);
  assert.ok(timeline.timelineEntrySortValue(state.time, entries[0]) < timeline.worldDateOrdinalMinute(state.time.calendar, current));
});

test("GM can add distinct historical facts on the same stipulated world date", () => {
  const state = structuredClone(game.initialState);
  state.timeline = [];
  const current = timeline.timelineEntryWorldDate(state.time, {
    id: "now",
    title: "now",
    description: "now",
    campaignMinute: state.time.campaignMinute,
    createdAt: new Date().toISOString(),
    kind: "other",
    tags: [],
    visibility: "public",
    importance: "normal",
  });
  const date = { year: current.year - 3, monthIndex: current.monthIndex, day: Math.max(1, current.day - 1), hour: 12, minute: 0 };
  const first = gm.executeGmTool(state, "timeline_entry_add", JSON.stringify({
    title: "Zervyna entrou na academia",
    description: "Zervyna iniciou seus estudos na Academia Deathlock.",
    kind: "milestone",
    ...date,
  }));
  const second = gm.executeGmTool(first.state, "timeline_entry_add", JSON.stringify({
    title: "Zervyna conheceu sua turma",
    description: "No mesmo dia, Zervyna conheceu os colegas que treinariam com ela.",
    kind: "relationship",
    ...date,
  }));
  assert.equal(second.result.ok, true);
  assert.equal(second.state.timeline.length, 2);
  assert.deepEqual(second.state.timeline[0].worldDate, second.state.timeline[1].worldDate);
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
