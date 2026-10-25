import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { buildCompendiumSections } from "../lib/compendium/grouping.ts";

const payload = JSON.parse(fs.readFileSync(new URL("../lib/compendium/daggerheart.generated.json", import.meta.url), "utf8"));
const { entries } = payload;
const order = payload.categories.map((category) => category.id);
const flatten = (sections) => sections.flatMap((section) => {
  if (section.kind === "families") return [...section.families.flatMap(({ parent, children }) => [parent, ...children]), ...section.ungrouped];
  if (section.kind === "domains") return section.domains.flatMap((domain) => domain.levels.flatMap((level) => level.entries));
  if (section.kind === "beastforms") return section.tiers.flatMap((tier) => tier.entries);
  return section.entries;
});

test("the organized compendium preserves every real entry exactly once", () => {
  const sections = buildCompendiumSections(entries, entries, order);
  const displayed = flatten(sections);
  assert.equal(displayed.length, entries.length);
  assert.equal(new Set(displayed.map((entry) => entry.id)).size, entries.length);
  assert.deepEqual(displayed.map((entry) => entry.id).sort(), entries.map((entry) => entry.id).sort());
  for (const [category, parentCount, childCount] of [["classes", 15, 42], ["ancestries", 24, 48], ["communities", 15, 15], ["subclasses", 31, 149]]) {
    const section = sections.find((item) => item.category === category);
    assert.equal(section.kind, "families");
    assert.equal(section.families.length, parentCount);
    assert.equal(section.families.reduce((count, family) => count + family.children.length, 0), childCount);
    assert.equal(section.ungrouped.length, 0);
    for (const { parent, children } of section.families) {
      assert.ok(children.every((child) => child.parent === parent.sourceId));
    }
  }
});

test("a matching feature keeps its parent as context and only includes matching siblings", () => {
  const feature = entries.find((entry) => entry.type === "classFeature" && entry.parent === "Rogue");
  const [section] = buildCompendiumSections(entries, [feature], order);
  assert.equal(section.families.length, 1);
  assert.equal(section.families[0].parent.sourceId, "Rogue");
  assert.deepEqual(section.families[0].children.map((entry) => entry.id), [feature.id]);
});

test("a matching parent includes its full feature list and subclass tiers stay in order", () => {
  const parent = entries.find((entry) => entry.type === "subclass" && entry.sourceId === "Stalwart");
  const [section] = buildCompendiumSections(entries, [parent], order);
  const { children } = section.families[0];
  assert.deepEqual(new Set(children.map((entry) => entry.id)), new Set(entries.filter((entry) => entry.type === "subclassFeature" && entry.parent === parent.sourceId).map((entry) => entry.id)));
  const tiers = { foundation: 0, specialization: 1, mastery: 2 };
  const sequence = children.map((entry) => tiers[entry.tier]);
  assert.deepEqual(sequence, sequence.toSorted((a, b) => a - b));
});

test("all eleven domains group cards by numeric level and normalize domain capitalization", () => {
  const cards = entries.filter((entry) => entry.type === "domainCard").map((entry, index) => index === 0 ? { ...entry, domain: entry.domain.toUpperCase() } : entry);
  const [section] = buildCompendiumSections(cards, cards, order);
  assert.equal(section.kind, "domains");
  assert.equal(section.domains.length, 11);
  for (const domain of section.domains) {
    assert.deepEqual(domain.levels.map((group) => group.level), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const group of domain.levels) {
      assert.ok(group.entries.every((card) => card.domain.toLowerCase() === domain.id && card.level === group.level));
    }
  }
  assert.equal(flatten([section]).length, 231);
});

test("filtered domain cards keep only the requested level", () => {
  const matches = entries.filter((entry) => entry.type === "domainCard" && entry.level === 2 && entry.domain.toLowerCase() === "arcana");
  const [section] = buildCompendiumSections(entries, matches, order);
  assert.equal(section.domains.length, 1);
  assert.deepEqual(section.domains[0].levels.map((group) => group.level), [2]);
  assert.equal(flatten([section]).length, matches.length);
});

test("an unresolved relationship remains visible", () => {
  const feature = { ...entries.find((entry) => entry.type === "classFeature"), parent: "Unknown future class" };
  const [section] = buildCompendiumSections([feature], [feature], order);
  assert.deepEqual(section.ungrouped, [feature]);
  assert.deepEqual(flatten([section]), [feature]);
});
