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
const advancement = await import("../lib/daggerheartAdvancement.ts");

function card(id, level, domain = "Arcana") {
  return { id, name: `Carta ${id}`, domain, level };
}

function characterAtLevelOne(className = "Druid") {
  return {
    id: "pc",
    name: "Aster",
    archetype: `${className} · Círculo de Renovação`,
    level: 1,
    tier: 1,
    evasion: 10,
    damageThresholds: { major: 7, severe: 14 },
    proficiency: 1,
    hp: 0,
    maxHp: 6,
    hope: 2,
    maxHope: 6,
    stress: 0,
    maxStress: 6,
    armor: 0,
    maxArmor: 3,
    conditions: [],
    daggerheart: {
      class: { id: className, name: className },
      subclass: { id: "Warden of Renewal", name: "Warden of Renewal" },
      classFeatures: [],
      subclassFeatures: [{ id: "foundation", name: "Foundation" }],
      ancestry: {
        mixed: false,
        primary: { id: "Human", name: "Human" },
        features: [],
      },
      community: { id: "Wanderborne", name: "Wanderborne", features: [] },
      traits: { agility: 2, strength: 1, finesse: 1, instinct: 0, presence: 0, knowledge: -1 },
      experiences: [{ name: "Curandeiro", bonus: 2 }, { name: "Explorador", bonus: 2 }],
      domains: ["Arcana", "Sage"],
      domainCards: [card("start-a", 1), card("start-b", 1, "Sage")],
      connections: [],
      history: "",
      trackers: [],
    },
  };
}

function choice(targetLevel, advancements, domainCard, tierAchievementExperience) {
  return {
    targetLevel,
    advancements,
    domainCard,
    ...(tierAchievementExperience ? { tierAchievementExperience } : {}),
  };
}

test("narrative milestone creates a pending level-up without changing level or using XP", () => {
  const state = {
    ...structuredClone(game.initialState),
    campaign: { ...structuredClone(game.initialState.campaign), system: "Daggerheart" },
    character: characterAtLevelOne(),
    milestones: [],
    pendingLevelUp: undefined,
  };
  const triggered = advancement.triggerCampaignMilestoneLevelUp(state, "O grupo selou a Fenda Rubra.", "Fenda Rubra");
  assert.equal(triggered.result.ok, true);
  assert.equal(triggered.state.character.level, 1);
  assert.equal(triggered.state.pendingLevelUp?.fromLevel, 1);
  assert.equal(triggered.state.pendingLevelUp?.targetLevel, 2);
  assert.equal(triggered.state.milestones?.at(-1)?.status, "pending");
  assert.equal("xp" in triggered.state.character, false);
});

test("level 2 applies tier achievement, exactly two advances, thresholds, and the mandatory domain card", () => {
  const character = characterAtLevelOne();
  const levelTwo = choice(2, [
    { kind: "hp", sourceTier: 2 },
    { kind: "evasion", sourceTier: 2 },
  ], card("level-2", 2), "Sobrevivente da Fenda");
  const applied = advancement.applyDaggerheartLevelUp(character, [], levelTwo);
  assert.equal(applied.ok, true);
  assert.equal(applied.character.level, 2);
  assert.equal(applied.character.tier, 2);
  assert.equal(applied.character.proficiency, 2);
  assert.equal(applied.character.maxHp, 7);
  assert.equal(applied.character.evasion, 11);
  assert.deepEqual(applied.character.damageThresholds, { major: 8, severe: 15 });
  assert.deepEqual(applied.character.daggerheart.experiences.at(-1), { name: "Sobrevivente da Fenda", bonus: 2 });
  assert.equal(applied.character.daggerheart.domainCards.some((entry) => entry.id === "level-2"), true);
});

test("advancement validation enforces exactly two points and source-tier slot limits", () => {
  const base = characterAtLevelOne();
  const onlyOne = advancement.validateAdvancementLevelChoice(base, choice(2, [
    { kind: "hp", sourceTier: 2 },
  ], card("level-2", 2), "Marco Dois"));
  assert.equal(onlyOne.ok, false);
  assert.match(onlyOne.errors.join("\n"), /exatamente 2 pontos/i);

  let current = advancement.applyDaggerheartLevelUp(base, [], choice(2, [
    { kind: "hp", sourceTier: 2 },
    { kind: "trait", sourceTier: 2, traits: ["agility", "strength"] },
  ], card("level-2b", 2), "Marco Dois")).character;
  current = advancement.applyDaggerheartLevelUp(current, [], choice(3, [
    { kind: "hp", sourceTier: 2 },
    { kind: "stress", sourceTier: 2 },
  ], card("level-3", 3))).character;
  const thirdHp = advancement.validateAdvancementLevelChoice(current, choice(4, [
    { kind: "hp", sourceTier: 2 },
    { kind: "stress", sourceTier: 2 },
  ], card("level-4", 4)));
  assert.equal(thirdHp.ok, false);
  assert.match(thirdHp.errors.join("\n"), /slot disponível para hp/i);
});

test("tier 3 clears trait marks while preserving permanent trait bonuses", () => {
  const plan = [
    choice(2, [
      { kind: "trait", sourceTier: 2, traits: ["agility", "strength"] },
      { kind: "hp", sourceTier: 2 },
    ], card("p2", 2), "Experiência P2"),
    choice(3, [
      { kind: "trait", sourceTier: 2, traits: ["finesse", "instinct"] },
      { kind: "stress", sourceTier: 2 },
    ], card("p3", 3)),
    choice(4, [
      { kind: "trait", sourceTier: 2, traits: ["presence", "knowledge"] },
      { kind: "evasion", sourceTier: 2 },
    ], card("p4", 4)),
    choice(5, [
      { kind: "trait", sourceTier: 3, traits: ["agility", "strength"] },
      { kind: "hp", sourceTier: 3 },
    ], card("p5", 5), "Experiência P3"),
  ];
  const applied = advancement.applyDaggerheartLevelUpPlan(characterAtLevelOne(), [], plan);
  assert.equal(applied.ok, true);
  assert.equal(applied.character.level, 5);
  assert.equal(applied.character.proficiency, 3);
  assert.equal(applied.character.daggerheart.traits.agility, 4);
  assert.equal(applied.character.daggerheart.traits.strength, 3);
  assert.deepEqual(new Set(applied.character.progression.traitMarks), new Set(["agility", "strength"]));
});

test("Proficiency is a two-point advancement and subclass blocks multiclass only in that source tier", () => {
  const toFive = advancement.applyDaggerheartLevelUpPlan(characterAtLevelOne(), [], [
    choice(2, [{ kind: "hp", sourceTier: 2 }, { kind: "stress", sourceTier: 2 }], card("q2", 2), "Q2"),
    choice(3, [{ kind: "hp", sourceTier: 2 }, { kind: "stress", sourceTier: 2 }], card("q3", 3)),
    choice(4, [{ kind: "domain", sourceTier: 2, card: card("extra-q4", 4) }, { kind: "evasion", sourceTier: 2 }], card("q4", 4)),
    choice(5, [{ kind: "proficiency", sourceTier: 3 }], card("q5", 5), "Q5"),
  ]);
  assert.equal(toFive.ok, true);
  assert.equal(toFive.character.proficiency, 4, "automatic Tier 3 proficiency and one optional proficiency both apply");

  const levelSix = advancement.applyDaggerheartLevelUp(toFive.character, [], choice(6, [
    { kind: "subclass", sourceTier: 3, feature: { id: "spec", name: "Especialização" } },
    { kind: "evasion", sourceTier: 3 },
  ], card("q6", 6)));
  assert.equal(levelSix.ok, true);
  const blockedMulticlass = advancement.validateAdvancementLevelChoice(levelSix.character, choice(7, [{
    kind: "multiclass",
    sourceTier: 3,
    class: { id: "Warrior", name: "Warrior" },
    domain: "Blade",
    subclass: { id: "Call of the Brave", name: "Call of the Brave" },
    classFeatures: [{ id: "attack-of-opportunity", name: "Attack of Opportunity" }],
    foundationFeatures: [{ id: "courage", name: "Courage" }],
  }], card("q7", 7)));
  assert.equal(blockedMulticlass.ok, false);
  assert.match(blockedMulticlass.errors.join("\n"), /Tier 3.*subclasse.*multiclasse|Tier 3.*multiclasse/i);
});

test("completing a pending milestone persists the level and marks that milestone completed", () => {
  const state = {
    ...structuredClone(game.initialState),
    campaign: { ...structuredClone(game.initialState.campaign), system: "Daggerheart" },
    character: characterAtLevelOne(),
    milestones: [],
    pendingLevelUp: undefined,
  };
  const triggered = advancement.triggerCampaignMilestoneLevelUp(state, "Vitória sobre o Arauto.");
  const completed = advancement.completePendingDaggerheartLevelUp(triggered.state, choice(2, [
    { kind: "hp", sourceTier: 2 },
    { kind: "stress", sourceTier: 2 },
  ], card("milestone-l2", 2), "Arauto Caído"));
  assert.equal(completed.result.ok, true);
  assert.equal(completed.state.pendingLevelUp, undefined);
  assert.equal(completed.state.character.level, 2);
  assert.equal(completed.state.milestones?.at(-1)?.status, "completed");
});

test("Brawler can spend the class-specific advancement once per tier to step the Combo Die", () => {
  const brawler = characterAtLevelOne("Brawler");
  const applied = advancement.applyDaggerheartLevelUp(brawler, [], choice(2, [
    { kind: "classSpecific", sourceTier: 2, id: "brawler-combo-die" },
    { kind: "hp", sourceTier: 2 },
  ], card("brawler-l2", 2), "Punhos Temperados"));
  assert.equal(applied.ok, true);
  const combo = applied.character.daggerheart.trackers.find((tracker) => tracker.id === "brawler-combo-die");
  assert.equal(combo?.dieSides, 6);
  const reused = advancement.validateAdvancementLevelChoice(applied.character, choice(3, [
    { kind: "classSpecific", sourceTier: 2, id: "brawler-combo-die" },
    { kind: "stress", sourceTier: 2 },
  ], card("brawler-l3", 3)));
  assert.equal(reused.ok, false);
  assert.match(reused.errors.join("\n"), /slot disponível para classSpecific|slot.*classSpecific/i);
});

test("Beastbound level-up requires companion training and tier Experience, then applies both", () => {
  const ranger = characterAtLevelOne("Ranger");
  ranger.daggerheart.subclass = { id: "Beastbound", name: "Beastbound" };
  ranger.daggerheart.subclassFeatures = [{ id: "Companion", name: "Companion" }];
  ranger.daggerheart.animalCompanion = {
    name: "Luma",
    kind: "Lobo",
    evasion: 10,
    stress: 0,
    maxStress: 3,
    damageDie: "d6",
    range: "Corpo a Corpo",
    damageType: "physical",
    experiences: [{ name: "Farejadora", bonus: 2 }, { name: "Guardiã", bonus: 2 }],
    training: [],
  };
  const incomplete = advancement.validateAdvancementLevelChoice(ranger, choice(2, [
    { kind: "hp", sourceTier: 2 },
    { kind: "stress", sourceTier: 2 },
  ], card("ranger-l2", 2), "Caçador das Brumas"));
  assert.equal(incomplete.ok, false);
  assert.match(incomplete.errors.join("\n"), /companheiro/i);

  const fullChoice = {
    ...choice(2, [
      { kind: "hp", sourceTier: 2 },
      { kind: "stress", sourceTier: 2 },
    ], card("ranger-l2", 2), "Caçador das Brumas"),
    companionTierExperience: "Sobreviveu à Matilha",
    companionChoices: [{ kind: "aware" }],
  };
  const applied = advancement.applyDaggerheartLevelUp(ranger, [], fullChoice);
  assert.equal(applied.ok, true);
  assert.equal(applied.character.daggerheart.animalCompanion.evasion, 12);
  assert.deepEqual(applied.character.daggerheart.animalCompanion.experiences.at(-1), { name: "Sobreviveu à Matilha", bonus: 2 });
  assert.equal(applied.character.daggerheart.animalCompanion.training.includes("Aware"), true);
});

test("Expert and Advanced Training increase the number of required companion level-up choices", () => {
  const ranger = characterAtLevelOne("Ranger");
  ranger.daggerheart.subclass = { id: "Beastbound", name: "Beastbound" };
  ranger.daggerheart.animalCompanion = {
    name: "Luma",
    evasion: 10,
    stress: 0,
    maxStress: 3,
    damageDie: "d6",
    range: "Corpo a Corpo",
    damageType: "physical",
    experiences: [{ name: "Farejadora", bonus: 2 }, { name: "Guardiã", bonus: 2 }],
    training: [],
  };
  assert.equal(advancement.companionAdvancementChoiceCount(ranger), 1);
  ranger.daggerheart.subclassFeatures.push({ id: "expert-training", name: "Expert Training" });
  assert.equal(advancement.companionAdvancementChoiceCount(ranger), 2);
  ranger.daggerheart.subclassFeatures.push({ id: "advanced-training", name: "Advanced Training" });
  assert.equal(advancement.companionAdvancementChoiceCount(ranger), 4);
});

test("a subclass card advancement can grant every feature printed on that card", () => {
  const toFive = advancement.applyDaggerheartLevelUpPlan(characterAtLevelOne(), [], [
    choice(2, [{ kind: "hp", sourceTier: 2 }, { kind: "stress", sourceTier: 2 }], card("s2", 2), "S2"),
    choice(3, [{ kind: "hp", sourceTier: 2 }, { kind: "stress", sourceTier: 2 }], card("s3", 3)),
    choice(4, [{ kind: "domain", sourceTier: 2, card: card("s4-extra", 4) }, { kind: "evasion", sourceTier: 2 }], card("s4", 4)),
    choice(5, [{ kind: "experience", sourceTier: 3, experiences: ["Curandeiro", "Explorador"] }, { kind: "evasion", sourceTier: 3 }], card("s5", 5), "S5"),
  ]);
  assert.equal(toFive.ok, true);
  const upgraded = advancement.applyDaggerheartLevelUp(toFive.character, [], choice(6, [
    {
      kind: "subclass",
      sourceTier: 3,
      features: [
        { id: "spec-a", name: "Especialização A" },
        { id: "spec-b", name: "Especialização B" },
      ],
    },
    { kind: "hp", sourceTier: 3 },
  ], card("s6", 6)));
  assert.equal(upgraded.ok, true);
  assert.equal(upgraded.character.daggerheart.subclassFeatures.some((entry) => entry.id === "spec-a"), true);
  assert.equal(upgraded.character.daggerheart.subclassFeatures.some((entry) => entry.id === "spec-b"), true);
});
