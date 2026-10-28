import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildCompendiumSections } from "../lib/compendium/grouping.ts";

const payload = JSON.parse(fs.readFileSync(new URL("../lib/compendium/daggerheart.generated.json", import.meta.url), "utf8"));
test("all 24 beastforms are available with translated stats and abilities", () => {
  assert.ok(payload.categories.some((c) => c.id === "beastforms"));
  const forms = payload.entries.filter((e) => e.type === "beastform");
  assert.equal(forms.length, 24);
  for (const form of forms) {
    assert.ok(form.beastformTier >= 1 && form.beastformTier <= 4);
    assert.match(form.description, /Evasão/);
    assert.doesNotMatch(form.description, /Compendium\.|@prof|\[\[|<[^>]+>/);
  }
  const scout = forms.find((e) => e.sourceId === "Agile Scout");
  assert.equal(scout.name, "Explorador Ágil");
  assert.match(scout.description, /Agilidade \+1/);
  assert.match(scout.description, /Evasão \+2/);
  assert.match(scout.description, /Ágil/);
  assert.match(scout.description, /Frágil/);
  assert.match(scout.description, /Camundongo/);
});

test("Carrier preserves the capacity of each beastform", () => {
  for (const [name, count] of [["Mighty Strider", 2], ["Massive Behemoth", 4], ["Mythic Aerial Hunter", 3]]) {
    const form = payload.entries.find((e) => e.type === "beastform" && e.sourceId === name);
    assert.ok(form.description.includes(`até ${count} aliados voluntários`));
  }
});

test("beastforms group by patamar and preserve search results", () => {
  const forms = payload.entries.filter((e) => e.type === "beastform");
  const sections = buildCompendiumSections(payload.entries, forms, payload.categories.map((c) => c.id));
  assert.equal(sections.length, 1);
  assert.equal(sections[0].kind, "beastforms");
  assert.deepEqual(sections[0].tiers.map((t) => t.tier), [1, 2, 3, 4]);
  assert.deepEqual(sections[0].tiers.map((t) => t.entries.length), [6, 6, 6, 6]);
  const scout = forms.find((e) => e.sourceId === "Agile Scout");
  const [filtered] = buildCompendiumSections(payload.entries, [scout], ["beastforms"]);
  assert.deepEqual(filtered.tiers.flatMap((t) => t.entries), [scout]);
});
