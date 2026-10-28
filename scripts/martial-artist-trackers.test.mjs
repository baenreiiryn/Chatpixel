import assert from "node:assert/strict";
import test from "node:test";
import { initialTrackersForCharacter, reconcileCharacterTrackers } from "../lib/daggerheartCharacter.ts";

test("Martial Artist receives a usable six-slot Focus counter", () => {
  const focus = initialTrackersForCharacter("Brawler", 1, "Martial Artist").find((tracker) => tracker.name === "Foco");
  assert.ok(focus);
  assert.equal(focus.kind, "counter");
  assert.equal(focus.value, 0);
  assert.equal(focus.max, 6);
  assert.equal(focus.source.id, "Stance Fighter");
  assert.equal(initialTrackersForCharacter("Brawler", 1, "Juggernaut").some((tracker) => tracker.name === "Foco"), false);
});

test("existing Martial Artists gain the counter without losing saved Focus", () => {
  const added = reconcileCharacterTrackers([], "Pugilista", 5, "Artista Marcial");
  const focus = added.find((tracker) => tracker.name === "Foco");
  assert.ok(focus);
  focus.value = 4;
  const restored = reconcileCharacterTrackers(added, "Pugilista", 8, "Artista Marcial");
  assert.equal(restored.find((tracker) => tracker.name === "Foco")?.value, 4);
});
