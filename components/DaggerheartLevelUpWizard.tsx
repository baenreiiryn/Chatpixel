"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CLASS_CONFIG,
  TRAIT_LABELS,
  TRAIT_ORDER,
  classEntries,
  classFeaturesFor,
  subclassFeaturesFor,
  subclassesFor,
} from "@/lib/characterCreation/daggerheart";
import { daggerheartCompendium, type CompendiumEntry, type SubclassFeatureTier } from "@/lib/compendium/daggerheart";
import {
  advancementOptionsForCharacter,
  applyDaggerheartLevelUp,
  companionAdvancementChoiceCount,
  ensureDaggerheartProgressionState,
  validateAdvancementLevelChoice,
  type DaggerheartAdvancementChoice,
  type DaggerheartAdvancementKind,
  type DaggerheartAdvancementTier,
  type DaggerheartCompanionAdvancementChoice,
  type DaggerheartCompanionAdvancementKind,
  type DaggerheartLevelUpChoice,
  type DaggerheartLevelUpPlan,
} from "@/lib/daggerheartAdvancement";
import { daggerheartTierForLevel, normalizeDaggerheartClassId } from "@/lib/daggerheartCharacter";
import type { CharacterDomainCard, CharacterFeatureRef, CharacterState, CharacterTraitName, InventoryItem } from "@/lib/game";

export type DaggerheartLevelUpWizardProps = {
  baseCharacter: CharacterState;
  inventory: InventoryItem[];
  targetLevel: number;
  onComplete: (choices: DaggerheartLevelUpPlan, finalCharacter: CharacterState) => void | Promise<void>;
  onCancel?: () => void;
  mode?: "modal" | "inline";
};

type DraftAdvancement = {
  key: string;
  kind: DaggerheartAdvancementKind;
  sourceTier: DaggerheartAdvancementTier;
  traits: CharacterTraitName[];
  experiences: string[];
  domainCardId: string;
  subclassSourceId: string;
  subclassTier?: "specialization" | "mastery";
  multiclassClassId: string;
  multiclassDomain: string;
  multiclassSubclassId: string;
};

type CompanionDraft = {
  key: string;
  kind: DaggerheartCompanionAdvancementKind | "";
  experience: string;
  improvement: "damageDie" | "range";
};

type SubclassUpgradeOption = {
  sourceId: string;
  name: string;
  tier: "specialization" | "mastery";
  features: CompendiumEntry[];
};

const ADVANCEMENT_META: Record<DaggerheartAdvancementKind, { label: string; description: string; cost: 1 | 2 }> = {
  trait: { label: "Dois traços", description: "Aumente dois traços ainda não marcados em +1.", cost: 1 },
  hp: { label: "+1 PV máximo", description: "Adicione permanentemente um espaço de Ponto de Vida.", cost: 1 },
  stress: { label: "+1 Fadiga máxima", description: "Adicione permanentemente um espaço de Fadiga.", cost: 1 },
  experience: { label: "Duas Experiências", description: "Aumente duas Experiências existentes em +1.", cost: 1 },
  domain: { label: "Carta de domínio extra", description: "Adquira uma carta adicional permitida pelo seu nível.", cost: 1 },
  evasion: { label: "+1 Evasão", description: "Aumente sua Evasão permanentemente em 1.", cost: 1 },
  subclass: { label: "Aprimorar subclasse", description: "Pegue a próxima carta da sua subclasse.", cost: 1 },
  proficiency: { label: "+1 Proficiência", description: "Consome os dois pontos de avanço deste nível.", cost: 2 },
  multiclass: { label: "Multiclasse", description: "Escolha classe, domínio e subclasse adicionais. Consome os dois pontos.", cost: 2 },
  classSpecific: { label: "Dado de Combo", description: "Pugilista: aumente o Dado de Combo em um passo, uma vez por Patamar.", cost: 1 },
};

const COMPANION_OPTIONS: Array<{ kind: DaggerheartCompanionAdvancementKind; label: string; description: string; limit: number }> = [
  { kind: "intelligent", label: "Inteligente", description: "+1 em uma Experiência do companheiro.", limit: 3 },
  { kind: "lightInTheDark", label: "Luz na Escuridão", description: "Adiciona um espaço de Esperança ao personagem.", limit: 1 },
  { kind: "creatureComfort", label: "Conforto da Criatura", description: "Desbloqueia a recuperação conjunta em um momento de carinho.", limit: 1 },
  { kind: "armored", label: "Blindado", description: "Permite usar sua Armadura para proteger o companheiro.", limit: 1 },
  { kind: "vicious", label: "Feroz", description: "Aumente o dado de dano ou o alcance em um passo.", limit: 3 },
  { kind: "resilient", label: "Resiliente", description: "+1 espaço de Fadiga para o companheiro.", limit: 3 },
  { kind: "bonded", label: "Vinculado", description: "Desbloqueia o resgate do companheiro quando você marca seu último PV.", limit: 1 },
  { kind: "aware", label: "Atento", description: "+2 de Evasão para o companheiro.", limit: 3 },
];

const COMPANION_TRAINING_ALIASES: Record<DaggerheartCompanionAdvancementKind, string[]> = {
  intelligent: ["intelligent", "inteligente"],
  lightInTheDark: ["light in the dark", "luz na escuridao"],
  creatureComfort: ["creature comfort", "conforto"],
  armored: ["armored", "armadur", "blindado"],
  vicious: ["vicious", "feroz"],
  resilient: ["resilient", "resiliente"],
  bonded: ["bonded", "vinculad"],
  aware: ["aware", "atent"],
};

const TIER_ACHIEVEMENT_LEVELS = new Set([2, 5, 8]);

function normalizeToken(value: string | undefined | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function featureRef(entry: CompendiumEntry): CharacterFeatureRef {
  return { id: entry.id, name: entry.name };
}

function findEntryForRef(ref: CharacterFeatureRef | undefined, type: string) {
  if (!ref) return undefined;
  const refId = normalizeToken(ref.id);
  const refName = normalizeToken(ref.name);
  return daggerheartCompendium.entries.find((entry) =>
    entry.type === type
    && (
      entry.id === ref.id
      || normalizeToken(entry.sourceId) === refId
      || normalizeToken(entry.sourceId) === refName
      || normalizeToken(entry.name) === refName
    ),
  );
}

function mainClassId(character: CharacterState) {
  const ref = character.daggerheart?.class;
  const entry = findEntryForRef(ref, "class");
  return normalizeDaggerheartClassId(entry?.sourceId || ref?.id || ref?.name || "");
}

function mainSubclassSourceId(character: CharacterState) {
  const ref = character.daggerheart?.subclass;
  const entry = findEntryForRef(ref, "subclass");
  return entry?.sourceId || ref?.id || ref?.name || "";
}

function subclassEntry(sourceId: string) {
  const key = normalizeToken(sourceId);
  return daggerheartCompendium.entries.find((entry) =>
    entry.type === "subclass"
    && (normalizeToken(entry.sourceId) === key || normalizeToken(entry.id) === key || normalizeToken(entry.name) === key),
  );
}

function classEntry(sourceId: string) {
  const key = normalizeToken(sourceId);
  return classEntries().find((entry) => normalizeToken(entry.sourceId) === key || normalizeToken(entry.name) === key);
}

function tierAchievementRequired(level: number) {
  return TIER_ACHIEVEMENT_LEVELS.has(level);
}

function choiceCost(kind: DaggerheartAdvancementKind) {
  return ADVANCEMENT_META[kind].cost;
}

function pointsSpent(drafts: DraftAdvancement[]) {
  return drafts.reduce((total, draft) => total + choiceCost(draft.kind), 0);
}

function newDraft(key: string, kind: DaggerheartAdvancementKind, sourceTier: DaggerheartAdvancementTier): DraftAdvancement {
  return {
    key,
    kind,
    sourceTier,
    traits: [],
    experiences: [],
    domainCardId: "",
    subclassSourceId: "",
    multiclassClassId: "",
    multiclassDomain: "",
    multiclassSubclassId: "",
  };
}

function applyPlan(baseCharacter: CharacterState, inventory: InventoryItem[], plan: DaggerheartLevelUpChoice[]) {
  let current = baseCharacter;
  for (const choice of plan) {
    const applied = applyDaggerheartLevelUp(current, inventory, choice);
    if (!applied.ok) return { character: current, errors: applied.errors };
    current = applied.character;
  }
  return { character: current, errors: [] as string[] };
}

function existingSubclassSources(character: CharacterState) {
  const sources = new Set<string>();
  const main = mainSubclassSourceId(character);
  if (main) sources.add(main);
  const multiclass = ensureDaggerheartProgressionState(character.progression).multiclass;
  if (multiclass) {
    const entry = findEntryForRef(multiclass.subclass, "subclass");
    const source = entry?.sourceId || multiclass.subclass.id || multiclass.subclass.name;
    if (source) sources.add(source);
  }
  for (const ref of character.daggerheart?.subclassFeatures || []) {
    const entry = findEntryForRef(ref, "subclassFeature");
    if (entry?.parent) sources.add(entry.parent);
  }
  return [...sources];
}

function ownedSubclassFeatureTiers(character: CharacterState, sourceId: string) {
  const tiers = new Set<SubclassFeatureTier>();
  const refs = [...(character.daggerheart?.subclassFeatures || [])];
  const multiclass = ensureDaggerheartProgressionState(character.progression).multiclass;
  if (multiclass) refs.push(...multiclass.foundationFeatures);
  for (const ref of refs) {
    const entry = findEntryForRef(ref, "subclassFeature");
    if (entry?.parent === sourceId && entry.tier) tiers.add(entry.tier);
  }
  return tiers;
}

function subclassUpgradeOptions(character: CharacterState, drafts: DraftAdvancement[] = []): SubclassUpgradeOption[] {
  const drafted = new Map<string, Set<"specialization" | "mastery">>();
  for (const draft of drafts) {
    if (draft.kind !== "subclass" || !draft.subclassSourceId || !draft.subclassTier) continue;
    const tiers = drafted.get(draft.subclassSourceId) || new Set<"specialization" | "mastery">();
    tiers.add(draft.subclassTier);
    drafted.set(draft.subclassSourceId, tiers);
  }
  return existingSubclassSources(character).flatMap((sourceId) => {
    const owned = ownedSubclassFeatureTiers(character, sourceId);
    const chosen = drafted.get(sourceId) || new Set<"specialization" | "mastery">();
    const tier: "specialization" | "mastery" | null = !owned.has("specialization") && !chosen.has("specialization")
      ? "specialization"
      : !owned.has("mastery") && !chosen.has("mastery")
        ? "mastery"
        : null;
    if (!tier) return [];
    const features = subclassFeaturesFor(sourceId, tier);
    if (!features.length) return [];
    return [{ sourceId, name: subclassEntry(sourceId)?.name || sourceId, tier, features }];
  });
}

function accessibleDomains(character: CharacterState, targetLevel: number, draftMulticlassDomain = "") {
  const result = new Map<string, { domain: string; maxLevel: number }>();
  for (const domain of character.daggerheart?.domains || []) {
    result.set(normalizeToken(domain), { domain, maxLevel: targetLevel });
  }
  const multiclassDomain = draftMulticlassDomain || ensureDaggerheartProgressionState(character.progression).multiclass?.domain || "";
  if (multiclassDomain) {
    result.set(normalizeToken(multiclassDomain), { domain: multiclassDomain, maxLevel: Math.ceil(targetLevel / 2) });
  }
  return [...result.values()];
}

function domainCardOptions(character: CharacterState, targetLevel: number, draftMulticlassDomain = "") {
  const accessible = accessibleDomains(character, targetLevel, draftMulticlassDomain);
  const owned = new Set(
    (character.daggerheart?.domainCards || []).flatMap((card) => [card.id, `${normalizeToken(card.domain)}:${normalizeToken(card.name)}`]),
  );
  return daggerheartCompendium.entries
    .filter((entry) => {
      if (entry.type !== "domainCard" || !entry.domain || !entry.level) return false;
      if (owned.has(entry.id) || owned.has(`${normalizeToken(entry.domain)}:${normalizeToken(entry.name)}`)) return false;
      const rule = accessible.find((candidate) => normalizeToken(candidate.domain) === normalizeToken(entry.domain));
      return Boolean(rule && entry.level <= rule.maxLevel);
    })
    .sort((a, b) => (a.level || 0) - (b.level || 0) || (a.domain || "").localeCompare(b.domain || "") || a.name.localeCompare(b.name));
}

function toDomainCard(entry: CompendiumEntry): CharacterDomainCard {
  return { id: entry.id, name: entry.name, domain: entry.domain || "Domínio", level: entry.level || 1 };
}

function trainingKind(label: string): DaggerheartCompanionAdvancementKind | undefined {
  const key = normalizeToken(label);
  return COMPANION_OPTIONS.find((option) =>
    COMPANION_TRAINING_ALIASES[option.kind].some((alias) => key.includes(normalizeToken(alias))),
  )?.kind;
}

function companionTrainingCount(character: CharacterState, kind: DaggerheartCompanionAdvancementKind) {
  return (character.daggerheart?.animalCompanion?.training || []).filter((label) => trainingKind(label) === kind).length;
}

function companionBonusFromDrafts(drafts: DraftAdvancement[]) {
  let bonus = 0;
  for (const draft of drafts) {
    if (draft.kind !== "subclass" || !draft.subclassSourceId || !draft.subclassTier) continue;
    const features = subclassFeaturesFor(draft.subclassSourceId, draft.subclassTier);
    if (features.some((feature) => normalizeToken(feature.sourceId) === "expert training")) bonus += 1;
    if (features.some((feature) => normalizeToken(feature.sourceId) === "advanced training")) bonus += 2;
  }
  return bonus;
}

function formatBonus(value: number) {
  return value >= 0 ? `+${value}` : String(value);
}

export default function DaggerheartLevelUpWizard({
  baseCharacter,
  inventory,
  targetLevel,
  onComplete,
  onCancel,
  mode = "modal",
}: DaggerheartLevelUpWizardProps) {
  const safeTargetLevel = Math.max(baseCharacter.level, Math.min(10, Math.trunc(targetLevel || baseCharacter.level)));
  const [completedChoices, setCompletedChoices] = useState<DaggerheartLevelUpChoice[]>([]);
  const [draftAdvancements, setDraftAdvancements] = useState<DraftAdvancement[]>([]);
  const [tierExperience, setTierExperience] = useState("");
  const [companionTierExperience, setCompanionTierExperience] = useState("");
  const [normalDomainCardId, setNormalDomainCardId] = useState("");
  const [companionDrafts, setCompanionDrafts] = useState<CompanionDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const sequenceRef = useRef(0);

  const appliedCompleted = useMemo(
    () => applyPlan(baseCharacter, inventory, completedChoices),
    [baseCharacter, inventory, completedChoices],
  );
  const previewCharacter = appliedCompleted.character;
  const currentLevel = baseCharacter.level + completedChoices.length + 1;
  const currentTier = daggerheartTierForLevel(Math.min(currentLevel, 10));
  const hasPendingLevel = currentLevel <= safeTargetLevel;
  const needsTierAchievement = hasPendingLevel && tierAchievementRequired(currentLevel);
  const baseCompanionChoices = hasPendingLevel ? companionAdvancementChoiceCount(previewCharacter) : 0;
  const companionRequiredChoices = baseCompanionChoices + companionBonusFromDrafts(draftAdvancements);
  const isBeastbound = baseCompanionChoices > 0;

  const multiclassDraft = draftAdvancements.find((draft) => draft.kind === "multiclass");
  const draftMulticlassDomain = multiclassDraft?.multiclassDomain || "";
  const selectedExtraCards = new Set(
    draftAdvancements.filter((draft) => draft.kind === "domain" && draft.domainCardId).map((draft) => draft.domainCardId),
  );
  const normalDomainOptions = useMemo(
    () => domainCardOptions(previewCharacter, currentLevel, draftMulticlassDomain).filter((entry) => !selectedExtraCards.has(entry.id)),
    [previewCharacter, currentLevel, draftMulticlassDomain, [...selectedExtraCards].join("|")],
  );

  const experienceOptions = useMemo(() => {
    const options = (previewCharacter.daggerheart?.experiences || []).map((experience) => ({ ...experience }));
    if (needsTierAchievement && tierExperience.trim()) options.push({ name: tierExperience.trim(), bonus: 2 });
    return options;
  }, [previewCharacter, needsTierAchievement, tierExperience]);

  const companionExperienceOptions = useMemo(() => {
    const options = (previewCharacter.daggerheart?.animalCompanion?.experiences || []).map((experience) => ({ ...experience }));
    if (needsTierAchievement && isBeastbound && companionTierExperience.trim()) {
      options.push({ name: companionTierExperience.trim(), bonus: 2 });
    }
    return options;
  }, [previewCharacter, needsTierAchievement, isBeastbound, companionTierExperience]);

  useEffect(() => {
    setCompanionDrafts((current) => {
      if (current.length === companionRequiredChoices) return current;
      if (current.length > companionRequiredChoices) return current.slice(0, companionRequiredChoices);
      const next = [...current];
      while (next.length < companionRequiredChoices) {
        sequenceRef.current += 1;
        next.push({ key: `companion-${sequenceRef.current}`, kind: "", experience: "", improvement: "damageDie" });
      }
      return next;
    });
  }, [companionRequiredChoices]);

  useEffect(() => {
    if (normalDomainCardId && !normalDomainOptions.some((entry) => entry.id === normalDomainCardId)) setNormalDomainCardId("");
  }, [normalDomainCardId, normalDomainOptions]);

  function resetCurrentDraft() {
    setDraftAdvancements([]);
    setTierExperience("");
    setCompanionTierExperience("");
    setNormalDomainCardId("");
    setCompanionDrafts([]);
    setSubmitError("");
  }

  function draftCount(kind: DaggerheartAdvancementKind, sourceTier: DaggerheartAdvancementTier) {
    return draftAdvancements.filter((draft) => draft.kind === kind && draft.sourceTier === sourceTier).length;
  }

  function effectiveOptions(kind: DaggerheartAdvancementKind) {
    if (!hasPendingLevel) return [];
    return advancementOptionsForCharacter(previewCharacter, currentLevel)
      .filter((option) => option.kind === kind)
      .map((option) => {
        const currentDrafts = draftCount(kind, option.sourceTier);
        const blockedBySibling = (kind === "subclass" && draftAdvancements.some((draft) => draft.kind === "multiclass" && draft.sourceTier === option.sourceTier))
          || (kind === "multiclass" && draftAdvancements.some((draft) => draft.kind === "subclass" && draft.sourceTier === option.sourceTier));
        return {
          ...option,
          effectiveRemaining: Math.max(0, option.remainingSlots - currentDrafts),
          effectiveAvailable: option.available && option.remainingSlots > currentDrafts && !blockedBySibling,
        };
      });
  }

  function nextSourceTier(kind: DaggerheartAdvancementKind) {
    return effectiveOptions(kind).find((option) => option.effectiveAvailable)?.sourceTier || null;
  }

  function remainingSlots(kind: DaggerheartAdvancementKind) {
    return effectiveOptions(kind).reduce((total, option) => total + option.effectiveRemaining, 0);
  }

  function markedTraits(exceptKey?: string) {
    const progression = ensureDaggerheartProgressionState(previewCharacter.progression);
    const marked = new Set<CharacterTraitName>(currentLevel === 5 || currentLevel === 8 ? [] : progression.traitMarks);
    for (const draft of draftAdvancements) {
      if (draft.key === exceptKey || draft.kind !== "trait") continue;
      draft.traits.forEach((trait) => marked.add(trait));
    }
    return marked;
  }

  function canAddAdvancement(kind: DaggerheartAdvancementKind) {
    if (!hasPendingLevel || currentTier === 1) return false;
    if (pointsSpent(draftAdvancements) + choiceCost(kind) > 2) return false;
    if (!nextSourceTier(kind)) return false;
    if (kind === "hp" && previewCharacter.maxHp + draftAdvancements.filter((draft) => draft.kind === "hp").length >= 12) return false;
    if (kind === "stress" && previewCharacter.maxStress + draftAdvancements.filter((draft) => draft.kind === "stress").length >= 12) return false;
    if (kind === "trait" && TRAIT_ORDER.filter((trait) => !markedTraits().has(trait)).length < 2) return false;
    if (kind === "experience" && experienceOptions.length < 2) return false;
    if (kind === "domain" && domainCardOptions(previewCharacter, currentLevel, draftMulticlassDomain).filter((entry) => entry.id !== normalDomainCardId).length < 1) return false;
    if (kind === "subclass" && subclassUpgradeOptions(previewCharacter, draftAdvancements).length < 1) return false;
    if (kind === "multiclass" && classEntries().filter((entry) => entry.sourceId && entry.sourceId !== mainClassId(previewCharacter)).length < 1) return false;
    return true;
  }

  function addAdvancement(kind: DaggerheartAdvancementKind) {
    const sourceTier = nextSourceTier(kind);
    if (!sourceTier || !canAddAdvancement(kind)) return;
    sequenceRef.current += 1;
    const draft = newDraft(`advance-${sequenceRef.current}`, kind, sourceTier);
    if (kind === "subclass") {
      const option = subclassUpgradeOptions(previewCharacter, draftAdvancements)[0];
      if (option) {
        draft.subclassSourceId = option.sourceId;
        draft.subclassTier = option.tier;
      }
    }
    setDraftAdvancements((current) => [...current, draft]);
  }

  function updateDraft(key: string, update: Partial<DraftAdvancement>) {
    setDraftAdvancements((current) => current.map((draft) => draft.key === key ? { ...draft, ...update } : draft));
  }

  function toggleTrait(draft: DraftAdvancement, trait: CharacterTraitName) {
    if (markedTraits(draft.key).has(trait)) return;
    const selected = draft.traits.includes(trait);
    const traits = selected ? draft.traits.filter((candidate) => candidate !== trait) : draft.traits.length < 2 ? [...draft.traits, trait] : draft.traits;
    updateDraft(draft.key, { traits });
  }

  function toggleExperience(draft: DraftAdvancement, name: string) {
    const selected = draft.experiences.some((candidate) => normalizeToken(candidate) === normalizeToken(name));
    const experiences = selected
      ? draft.experiences.filter((candidate) => normalizeToken(candidate) !== normalizeToken(name))
      : draft.experiences.length < 2 ? [...draft.experiences, name] : draft.experiences;
    updateDraft(draft.key, { experiences });
  }

  function multiclassClasses() {
    const main = mainClassId(previewCharacter);
    return classEntries().filter((entry) => entry.sourceId && entry.sourceId !== main);
  }

  function companionOptionCount(kind: DaggerheartCompanionAdvancementKind, exceptKey?: string) {
    return companionTrainingCount(previewCharacter, kind)
      + companionDrafts.filter((draft) => draft.key !== exceptKey && draft.kind === kind).length;
  }

  function companionOptionAvailable(kind: DaggerheartCompanionAdvancementKind, exceptKey?: string) {
    const option = COMPANION_OPTIONS.find((candidate) => candidate.kind === kind);
    return Boolean(option && companionOptionCount(kind, exceptKey) < option.limit);
  }

  function updateCompanionDraft(key: string, update: Partial<CompanionDraft>) {
    setCompanionDrafts((current) => current.map((draft) => draft.key === key ? { ...draft, ...update } : draft));
  }

  function buildAdvancement(draft: DraftAdvancement): DaggerheartAdvancementChoice | null {
    const base = { sourceTier: draft.sourceTier };
    if (draft.kind === "trait") {
      if (draft.traits.length !== 2 || draft.traits[0] === draft.traits[1]) return null;
      return { ...base, kind: "trait", traits: [draft.traits[0], draft.traits[1]] };
    }
    if (draft.kind === "hp") return { ...base, kind: "hp" };
    if (draft.kind === "stress") return { ...base, kind: "stress" };
    if (draft.kind === "experience") {
      if (draft.experiences.length !== 2 || normalizeToken(draft.experiences[0]) === normalizeToken(draft.experiences[1])) return null;
      return { ...base, kind: "experience", experiences: [draft.experiences[0], draft.experiences[1]] };
    }
    if (draft.kind === "domain") {
      const entry = domainCardOptions(previewCharacter, currentLevel, draftMulticlassDomain).find((candidate) => candidate.id === draft.domainCardId);
      if (!entry || draft.domainCardId === normalDomainCardId) return null;
      return { ...base, kind: "domain", card: toDomainCard(entry) };
    }
    if (draft.kind === "evasion") return { ...base, kind: "evasion" };
    if (draft.kind === "subclass") {
      if (!draft.subclassSourceId || !draft.subclassTier) return null;
      const otherDrafts = draftAdvancements.filter((candidate) => candidate.key !== draft.key);
      const option = subclassUpgradeOptions(previewCharacter, otherDrafts)
        .find((candidate) => candidate.sourceId === draft.subclassSourceId && candidate.tier === draft.subclassTier);
      if (!option) return null;
      return { ...base, kind: "subclass", features: option.features.map(featureRef) };
    }
    if (draft.kind === "proficiency") return { ...base, kind: "proficiency" };
    if (draft.kind === "classSpecific") return { ...base, kind: "classSpecific", id: "brawler-combo-die" };
    if (draft.kind === "multiclass") {
      const entry = classEntry(draft.multiclassClassId);
      const config = CLASS_CONFIG[draft.multiclassClassId];
      const subclass = subclassesFor(draft.multiclassClassId).find((candidate) => candidate.sourceId === draft.multiclassSubclassId);
      const domain = config?.domains.find((candidate) => normalizeToken(candidate) === normalizeToken(draft.multiclassDomain));
      if (!entry || !config || !subclass || !domain) return null;
      return {
        ...base,
        kind: "multiclass",
        class: featureRef(entry),
        domain,
        subclass: featureRef(subclass),
        classFeatures: classFeaturesFor(draft.multiclassClassId).map(featureRef),
        foundationFeatures: subclassFeaturesFor(draft.multiclassSubclassId, "foundation").map(featureRef),
      };
    }
    return null;
  }

  function buildCompanionChoices(): DaggerheartCompanionAdvancementChoice[] | null {
    if (!companionRequiredChoices) return [];
    if (companionDrafts.length !== companionRequiredChoices) return null;
    const result: DaggerheartCompanionAdvancementChoice[] = [];
    const counts = new Map<DaggerheartCompanionAdvancementKind, number>();
    for (const draft of companionDrafts) {
      if (!draft.kind) return null;
      const option = COMPANION_OPTIONS.find((candidate) => candidate.kind === draft.kind);
      const used = companionTrainingCount(previewCharacter, draft.kind) + (counts.get(draft.kind) || 0);
      if (!option || used >= option.limit) return null;
      counts.set(draft.kind, (counts.get(draft.kind) || 0) + 1);
      if (draft.kind === "intelligent") {
        if (!draft.experience || !companionExperienceOptions.some((experience) => normalizeToken(experience.name) === normalizeToken(draft.experience))) return null;
        result.push({ kind: "intelligent", experience: draft.experience });
      } else if (draft.kind === "vicious") {
        result.push({ kind: "vicious", improvement: draft.improvement });
      } else {
        result.push({ kind: draft.kind });
      }
    }
    return result;
  }

  function tierExperienceValid() {
    if (!needsTierAchievement) return true;
    const name = tierExperience.trim();
    if (!name) return false;
    return !(previewCharacter.daggerheart?.experiences || []).some((experience) => normalizeToken(experience.name) === normalizeToken(name));
  }

  function companionTierExperienceValid() {
    if (!needsTierAchievement || !isBeastbound) return true;
    const name = companionTierExperience.trim();
    if (!name) return false;
    return !(previewCharacter.daggerheart?.animalCompanion?.experiences || []).some((experience) => normalizeToken(experience.name) === normalizeToken(name));
  }

  function buildCurrentChoice(): DaggerheartLevelUpChoice | null {
    if (!hasPendingLevel || !previewCharacter.daggerheart || pointsSpent(draftAdvancements) !== 2) return null;
    if (!tierExperienceValid() || !companionTierExperienceValid()) return null;
    const advancements = draftAdvancements.map(buildAdvancement);
    if (advancements.some((choice) => !choice)) return null;
    const normalCard = normalDomainOptions.find((entry) => entry.id === normalDomainCardId);
    if (!normalCard) return null;
    const companionChoices = buildCompanionChoices();
    if (!companionChoices) return null;
    return {
      targetLevel: currentLevel,
      ...(needsTierAchievement ? { tierAchievementExperience: tierExperience.trim() } : {}),
      ...(needsTierAchievement && isBeastbound ? { companionTierExperience: companionTierExperience.trim() } : {}),
      advancements: advancements as DaggerheartAdvancementChoice[],
      domainCard: toDomainCard(normalCard),
      ...(companionChoices.length ? { companionChoices } : {}),
    };
  }

  const rawCurrentChoice = buildCurrentChoice();
  const currentValidation = rawCurrentChoice ? validateAdvancementLevelChoice(previewCharacter, rawCurrentChoice) : null;
  const builtCurrentChoice = rawCurrentChoice && currentValidation?.ok ? rawCurrentChoice : null;
  const liveApplied = builtCurrentChoice ? applyDaggerheartLevelUp(previewCharacter, inventory, builtCurrentChoice) : null;
  const livePreviewCharacter = liveApplied?.ok ? liveApplied.character : previewCharacter;

  async function confirmCurrentLevel() {
    const choice = buildCurrentChoice();
    if (!choice) {
      setSubmitError("Complete os dois pontos de avanço e todas as escolhas obrigatórias deste nível.");
      return;
    }
    const applied = applyDaggerheartLevelUp(previewCharacter, inventory, choice);
    if (!applied.ok) {
      setSubmitError(applied.errors.join(" "));
      return;
    }
    const nextChoices = [...completedChoices, choice];
    if (currentLevel < safeTargetLevel) {
      setCompletedChoices(nextChoices);
      resetCurrentDraft();
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      await onComplete(nextChoices, applied.character);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Não foi possível concluir a evolução.");
    } finally {
      setSubmitting(false);
    }
  }

  function restorePreviousLevel() {
    const previous = completedChoices[completedChoices.length - 1];
    if (!previous) return;
    const remaining = completedChoices.slice(0, -1);
    const restoredPreview = applyPlan(baseCharacter, inventory, remaining).character;
    setCompletedChoices(remaining);
    setTierExperience(previous.tierAchievementExperience || "");
    setCompanionTierExperience(previous.companionTierExperience || "");
    setNormalDomainCardId(previous.domainCard.id);
    setDraftAdvancements(previous.advancements.map((advancement) => {
      sequenceRef.current += 1;
      const draft = newDraft(`advance-${sequenceRef.current}`, advancement.kind, advancement.sourceTier);
      if (advancement.kind === "trait") draft.traits = [...advancement.traits];
      if (advancement.kind === "experience") draft.experiences = [...advancement.experiences];
      if (advancement.kind === "domain") draft.domainCardId = advancement.card.id;
      if (advancement.kind === "subclass") {
        const entry = advancement.features.map((feature) => findEntryForRef(feature, "subclassFeature")).find(Boolean);
        draft.subclassSourceId = entry?.parent || "";
        draft.subclassTier = entry?.tier === "specialization" || entry?.tier === "mastery" ? entry.tier : undefined;
      }
      if (advancement.kind === "multiclass") {
        const cls = findEntryForRef(advancement.class, "class");
        const sub = findEntryForRef(advancement.subclass, "subclass");
        draft.multiclassClassId = cls?.sourceId || advancement.class.id;
        draft.multiclassDomain = advancement.domain;
        draft.multiclassSubclassId = sub?.sourceId || advancement.subclass.id;
      }
      return draft;
    }));
    setCompanionDrafts((previous.companionChoices || []).map((choice) => {
      sequenceRef.current += 1;
      return {
        key: `companion-${sequenceRef.current}`,
        kind: choice.kind,
        experience: choice.kind === "intelligent" ? choice.experience : "",
        improvement: choice.kind === "vicious" ? choice.improvement : "damageDie",
      };
    }));
    if (!restoredPreview.daggerheart) setSubmitError("Não foi possível restaurar a prévia do nível anterior.");
    else setSubmitError("");
  }

  async function finishWithoutPendingLevels() {
    setSubmitting(true);
    setSubmitError("");
    try {
      await onComplete([], baseCharacter);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Não foi possível concluir.");
    } finally {
      setSubmitting(false);
    }
  }

  const availableKinds = (Object.keys(ADVANCEMENT_META) as DaggerheartAdvancementKind[])
    .filter((kind) => effectiveOptions(kind).length > 0);
  const progressLevels = Array.from({ length: Math.max(0, safeTargetLevel - baseCharacter.level) }, (_, index) => baseCharacter.level + index + 1);

  const body = (
    <section className="daggerLevelWizard" aria-label="Evolução de personagem Daggerheart">
      <header className="daggerLevelWizardHeader">
        <div>
          <small>MARCO DE CAMPANHA · DAGGERHEART</small>
          <h2>{hasPendingLevel ? `Subir para o nível ${currentLevel}` : "Evolução em dia"}</h2>
          <p>{baseCharacter.name} · nível {baseCharacter.level} → {safeTargetLevel}</p>
        </div>
        {onCancel && <button type="button" className="daggerLevelWizardClose" onClick={onCancel} aria-label="Fechar">×</button>}
      </header>

      {progressLevels.length > 0 && (
        <div className="daggerLevelWizardProgress" aria-label="Progresso dos níveis">
          {progressLevels.map((level) => {
            const completed = level < currentLevel;
            const active = level === currentLevel;
            return <span key={level} className={completed ? "done" : active ? "active" : ""}><b>{completed ? "✓" : level}</b><small>P{daggerheartTierForLevel(level)}</small></span>;
          })}
        </div>
      )}

      {!baseCharacter.daggerheart ? (
        <div className="daggerLevelWizardEmpty"><b>Sem dados Daggerheart</b><p>Esta ficha não possui os dados mecânicos necessários para calcular os avanços.</p></div>
      ) : !hasPendingLevel ? (
        <div className="daggerLevelWizardEmpty">
          <b>Nenhum nível pendente.</b><p>O personagem já está no nível {baseCharacter.level}.</p>
          <button type="button" onClick={() => void finishWithoutPendingLevels()} disabled={submitting}>{submitting ? "Concluindo…" : "Concluir"}</button>
        </div>
      ) : (
        <div className="daggerLevelWizardBody">
          <main className="daggerLevelWizardMain">
            {needsTierAchievement && (
              <section className="daggerLevelWizardSection achievement">
                <div className="daggerLevelWizardSectionHeading"><div><small>1 · CONQUISTA DE PATAMAR</small><h3>Patamar {currentTier}</h3></div><span>Obrigatório</span></div>
                <p>Ganhe uma nova Experiência +2 e +1 de Proficiência{currentLevel === 5 || currentLevel === 8 ? "; as marcas de traço são limpas" : ""}.</p>
                <label className="daggerLevelWizardField">
                  <span>Nova Experiência +2</span>
                  <input value={tierExperience} onChange={(event) => setTierExperience(event.target.value)} placeholder="Ex.: Caçador de monstros" />
                  {tierExperience.trim() && !tierExperienceValid() && <em>Use um nome diferente das Experiências existentes.</em>}
                </label>
                {isBeastbound && (
                  <label className="daggerLevelWizardField">
                    <span>Nova Experiência do companheiro +2</span>
                    <input value={companionTierExperience} onChange={(event) => setCompanionTierExperience(event.target.value)} placeholder="Ex.: Farejador incansável" />
                    {companionTierExperience.trim() && !companionTierExperienceValid() && <em>Use um nome diferente das Experiências atuais do companheiro.</em>}
                  </label>
                )}
              </section>
            )}

            <section className="daggerLevelWizardSection">
              <div className="daggerLevelWizardSectionHeading">
                <div><small>2 · AVANÇOS</small><h3>Gaste exatamente 2 pontos</h3></div>
                <span className={pointsSpent(draftAdvancements) === 2 ? "complete" : ""}>{pointsSpent(draftAdvancements)} / 2</span>
              </div>
              <div className="daggerLevelAdvanceGrid">
                {availableKinds.map((kind) => {
                  const meta = ADVANCEMENT_META[kind];
                  const remaining = remainingSlots(kind);
                  return (
                    <button type="button" key={kind} disabled={!canAddAdvancement(kind)} onClick={() => addAdvancement(kind)}>
                      <span>{meta.cost} PT</span><strong>{meta.label}</strong><p>{meta.description}</p>
                      <small>{remaining} espaço{remaining === 1 ? "" : "s"} disponível{remaining === 1 ? "" : "is"}</small>
                    </button>
                  );
                })}
              </div>

              {draftAdvancements.length > 0 && (
                <div className="daggerLevelSelectedAdvances">
                  {draftAdvancements.map((draft) => {
                    const meta = ADVANCEMENT_META[draft.kind];
                    const subclassOptions = draft.kind === "subclass"
                      ? subclassUpgradeOptions(previewCharacter, draftAdvancements.filter((candidate) => candidate.key !== draft.key))
                      : [];
                    const otherExtraDomainCards = new Set(
                      draftAdvancements
                        .filter((candidate) => candidate.kind === "domain" && candidate.key !== draft.key && candidate.domainCardId)
                        .map((candidate) => candidate.domainCardId),
                    );
                    const extraDomainOptions = draft.kind === "domain"
                      ? domainCardOptions(previewCharacter, currentLevel, draftMulticlassDomain)
                        .filter((entry) => entry.id !== normalDomainCardId && !otherExtraDomainCards.has(entry.id))
                      : [];
                    const multiclassConfig = draft.multiclassClassId ? CLASS_CONFIG[draft.multiclassClassId] : undefined;
                    const multiclassSubclasses = draft.multiclassClassId ? subclassesFor(draft.multiclassClassId) : [];
                    return (
                      <article key={draft.key}>
                        <header>
                          <div><small>{meta.cost} PONTO{meta.cost === 2 ? "S" : ""} · ESPAÇO P{draft.sourceTier}</small><strong>{meta.label}</strong></div>
                          <button type="button" onClick={() => setDraftAdvancements((current) => current.filter((candidate) => candidate.key !== draft.key))}>Remover</button>
                        </header>

                        {draft.kind === "trait" && (
                          <div className="daggerLevelToggleGrid traits">
                            {TRAIT_ORDER.map((trait) => {
                              const blocked = markedTraits(draft.key).has(trait);
                              const selected = draft.traits.includes(trait);
                              return <button type="button" key={trait} className={selected ? "selected" : ""} disabled={blocked && !selected} onClick={() => toggleTrait(draft, trait)}><span>{TRAIT_LABELS[trait]}</span><b>{formatBonus(previewCharacter.daggerheart!.traits[trait])}</b></button>;
                            })}
                          </div>
                        )}

                        {draft.kind === "experience" && (
                          <div className="daggerLevelToggleGrid experiences">
                            {experienceOptions.map((experience) => (
                              <button type="button" key={experience.name} className={draft.experiences.some((name) => normalizeToken(name) === normalizeToken(experience.name)) ? "selected" : ""} onClick={() => toggleExperience(draft, experience.name)}>
                                <span>{experience.name}</span><b>{formatBonus(experience.bonus)}</b>
                              </button>
                            ))}
                          </div>
                        )}

                        {draft.kind === "domain" && (
                          <label className="daggerLevelWizardField compact"><span>Carta de domínio adicional</span>
                            <select value={draft.domainCardId} onChange={(event) => updateDraft(draft.key, { domainCardId: event.target.value })}>
                              <option value="">Escolha uma carta…</option>
                              {extraDomainOptions.map((entry) => <option key={entry.id} value={entry.id}>N{entry.level} · {entry.domain} · {entry.name}</option>)}
                            </select>
                          </label>
                        )}

                        {draft.kind === "subclass" && (
                          <div className="daggerLevelNestedChoice">
                            <label className="daggerLevelWizardField compact"><span>Subclasse a aprimorar</span>
                              <select
                                value={draft.subclassSourceId && draft.subclassTier ? `${draft.subclassSourceId}|${draft.subclassTier}` : ""}
                                onChange={(event) => {
                                  const [sourceId, tier] = event.target.value.split("|");
                                  updateDraft(draft.key, { subclassSourceId: sourceId, subclassTier: tier as "specialization" | "mastery" });
                                }}
                              >
                                <option value="">Escolha…</option>
                                {subclassOptions.map((option) => <option key={`${option.sourceId}-${option.tier}`} value={`${option.sourceId}|${option.tier}`}>{option.name} · {option.tier === "specialization" ? "Especialização" : "Maestria"}</option>)}
                              </select>
                            </label>
                            {draft.subclassSourceId && draft.subclassTier && <div className="daggerLevelFeatureList">{subclassFeaturesFor(draft.subclassSourceId, draft.subclassTier).map((feature) => <span key={feature.id}>{feature.name}</span>)}</div>}
                          </div>
                        )}

                        {draft.kind === "multiclass" && (
                          <div className="daggerLevelNestedChoice triple">
                            <label className="daggerLevelWizardField compact"><span>Classe adicional</span>
                              <select value={draft.multiclassClassId} onChange={(event) => updateDraft(draft.key, { multiclassClassId: event.target.value, multiclassDomain: "", multiclassSubclassId: "" })}>
                                <option value="">Escolha…</option>
                                {multiclassClasses().map((entry) => <option key={entry.id} value={entry.sourceId}>{entry.name}</option>)}
                              </select>
                            </label>
                            <label className="daggerLevelWizardField compact"><span>Um domínio da nova classe</span>
                              <select value={draft.multiclassDomain} disabled={!multiclassConfig} onChange={(event) => updateDraft(draft.key, { multiclassDomain: event.target.value })}>
                                <option value="">Escolha…</option>{multiclassConfig?.domains.map((domain) => <option key={domain} value={domain}>{domain}</option>)}
                              </select>
                            </label>
                            <label className="daggerLevelWizardField compact"><span>Subclasse · Fundação</span>
                              <select value={draft.multiclassSubclassId} disabled={!draft.multiclassClassId} onChange={(event) => updateDraft(draft.key, { multiclassSubclassId: event.target.value })}>
                                <option value="">Escolha…</option>{multiclassSubclasses.map((entry) => <option key={entry.id} value={entry.sourceId}>{entry.name}</option>)}
                              </select>
                            </label>
                          </div>
                        )}

                        {draft.kind === "classSpecific" && <div className="daggerLevelInlineResult"><span>Golpe Combinado</span><strong>+1 passo no Dado de Combo</strong></div>}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="daggerLevelWizardSection">
              <div className="daggerLevelWizardSectionHeading"><div><small>3 · LIMIARES</small><h3>+1 em todos os limiares</h3></div><span className="complete">Automático</span></div>
              <div className="daggerLevelThresholdPreview"><span><small>Maior</small><b>{previewCharacter.damageThresholds.major} → {previewCharacter.damageThresholds.major + 1}</b></span><i /><span><small>Severo</small><b>{previewCharacter.damageThresholds.severe} → {previewCharacter.damageThresholds.severe + 1}</b></span></div>
            </section>

            <section className="daggerLevelWizardSection">
              <div className="daggerLevelWizardSectionHeading"><div><small>4 · CARTA DE DOMÍNIO</small><h3>Uma nova carta é obrigatória</h3></div><span>Obrigatório</span></div>
              <label className="daggerLevelWizardField compact"><span>Carta de nível permitido</span>
                <select value={normalDomainCardId} onChange={(event) => setNormalDomainCardId(event.target.value)}>
                  <option value="">Escolha uma carta…</option>{normalDomainOptions.map((entry) => <option key={entry.id} value={entry.id}>N{entry.level} · {entry.domain} · {entry.name}</option>)}
                </select>
              </label>
              {draftMulticlassDomain && <p className="daggerLevelWizardHint">O novo domínio de multiclasse permite cartas até nível {Math.ceil(currentLevel / 2)}.</p>}
            </section>

            {companionRequiredChoices > 0 && (
              <section className="daggerLevelWizardSection companion">
                <div className="daggerLevelWizardSectionHeading"><div><small>COMPANHEIRO · TREINADOR</small><h3>{previewCharacter.daggerheart?.animalCompanion?.name || "Companheiro animal"}</h3></div><span>{companionRequiredChoices} escolha{companionRequiredChoices === 1 ? "" : "s"}</span></div>
                <p>Escolha uma opção de aumento para cada espaço liberado neste nível.</p>
                <div className="daggerLevelCompanionChoices">
                  {companionDrafts.map((draft, index) => {
                    const selected = COMPANION_OPTIONS.find((option) => option.kind === draft.kind);
                    return (
                      <article key={draft.key}>
                        <small>ESCOLHA {index + 1}</small>
                        <select value={draft.kind} onChange={(event) => updateCompanionDraft(draft.key, { kind: event.target.value as DaggerheartCompanionAdvancementKind | "", experience: "" })}>
                          <option value="">Escolha uma opção…</option>
                          {COMPANION_OPTIONS.map((option) => {
                            const used = companionOptionCount(option.kind, draft.key);
                            return <option key={option.kind} value={option.kind} disabled={!companionOptionAvailable(option.kind, draft.key) && draft.kind !== option.kind}>{option.label} · {used}/{option.limit}</option>;
                          })}
                        </select>
                        {selected && <p>{selected.description}</p>}
                        {draft.kind === "intelligent" && (
                          <select value={draft.experience} onChange={(event) => updateCompanionDraft(draft.key, { experience: event.target.value })}>
                            <option value="">Experiência alvo…</option>{companionExperienceOptions.map((experience) => <option key={experience.name} value={experience.name}>{experience.name} {formatBonus(experience.bonus)}</option>)}
                          </select>
                        )}
                        {draft.kind === "vicious" && (
                          <div className="daggerLevelSegmented">
                            <button type="button" className={draft.improvement === "damageDie" ? "selected" : ""} onClick={() => updateCompanionDraft(draft.key, { improvement: "damageDie" })}>Dado de dano</button>
                            <button type="button" className={draft.improvement === "range" ? "selected" : ""} onClick={() => updateCompanionDraft(draft.key, { improvement: "range" })}>Alcance</button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </main>

          <aside className="daggerLevelWizardPreview">
            <small>PRÉVIA APÓS ESTE NÍVEL</small><h3>{livePreviewCharacter.name}</h3><p>Nível {builtCurrentChoice ? livePreviewCharacter.level : currentLevel} · Patamar {builtCurrentChoice ? livePreviewCharacter.tier : currentTier}</p>
            <div className="daggerLevelPreviewStats">
              <span><small>PV MÁX.</small><b>{livePreviewCharacter.maxHp}</b></span><span><small>FADIGA</small><b>{livePreviewCharacter.maxStress}</b></span>
              <span><small>EVASÃO</small><b>{livePreviewCharacter.evasion}</b></span><span><small>PROF.</small><b>{livePreviewCharacter.proficiency}</b></span>
            </div>
            <div className="daggerLevelPreviewThresholds"><span>Maior <b>{builtCurrentChoice ? livePreviewCharacter.damageThresholds.major : previewCharacter.damageThresholds.major + 1}</b></span><span>Severo <b>{builtCurrentChoice ? livePreviewCharacter.damageThresholds.severe : previewCharacter.damageThresholds.severe + 1}</b></span></div>
            <div className="daggerLevelPreviewList">
              <span><b>{livePreviewCharacter.daggerheart?.experiences.length || 0}</b> Experiências</span><span><b>{livePreviewCharacter.daggerheart?.domainCards.length || 0}</b> cartas de domínio</span><span><b>{inventory.length}</b> itens no inventário</span>
              {livePreviewCharacter.daggerheart?.animalCompanion && <span><b>{livePreviewCharacter.daggerheart.animalCompanion.evasion}</b> Evasão do companheiro</span>}
            </div>
            <div className={`daggerLevelReadyState ${builtCurrentChoice ? "ready" : ""}`}><b>{builtCurrentChoice ? "✓" : "!"}</b><span>{builtCurrentChoice ? "Nível validado pelo núcleo de progressão." : currentValidation?.errors[0] || "Complete as escolhas obrigatórias."}</span></div>
          </aside>
        </div>
      )}

      {hasPendingLevel && baseCharacter.daggerheart && (
        <footer className="daggerLevelWizardFooter">
          <div>
            {completedChoices.length > 0 && <button type="button" className="secondary" onClick={restorePreviousLevel} disabled={submitting}>← Voltar um nível</button>}
            {onCancel && <button type="button" className="secondary" onClick={onCancel} disabled={submitting}>Cancelar</button>}
          </div>
          <button type="button" className="primary" disabled={!builtCurrentChoice || submitting} onClick={() => void confirmCurrentLevel()}>{submitting ? "Concluindo…" : currentLevel < safeTargetLevel ? `Aplicar nível ${currentLevel} e continuar` : `Concluir no nível ${currentLevel}`}</button>
        </footer>
      )}
      {submitError && <p className="daggerLevelWizardError">{submitError}</p>}
    </section>
  );

  return mode === "modal" ? <div className="daggerLevelWizardOverlay">{body}</div> : body;
}
