"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CLASS_CONFIG,
  REQUIRED_TRAIT_VALUES,
  TONE_OPTIONS,
  TRAIT_LABELS,
  TRAIT_ORDER,
  ancestryEntries,
  ancestryFeaturesFor,
  armorSlotsFromItems,
  classEntries,
  classFeaturesFor,
  communityEntries,
  communityFeaturesFor,
  levelOneDomainCards,
  subclassFeaturesFor,
  subclassesFor,
  suggestedTraitsFor,
} from "@/lib/characterCreation/daggerheart";
import { daggerheartCompendium, entryTypeLabel, type CompendiumEntry } from "@/lib/compendium/daggerheart";
import { extractNarration } from "@/lib/gm";
import type { CharacterTraitName, InventoryItem } from "@/lib/game";

type AiResponse = { output?: unknown[]; output_text?: unknown };

export type NewCampaignAiAdapter = {
  connected: boolean;
  model: string;
  respond: (payload: {
    model: string;
    instructions: string;
    input: unknown[];
    tools?: unknown[];
  }) => Promise<AiResponse>;
  onConnect: () => void | Promise<void>;
};

type CompanionDraft = {
  id: string;
  name: string;
  role: string;
  appearance?: string;
};

export type NewCampaignResult = {
  campaignName: string;
  tone: string;
  system: "Daggerheart";
  classEntry: CompendiumEntry;
  subclassEntry: CompendiumEntry;
  classFeatures: CompendiumEntry[];
  subclassFeatures: CompendiumEntry[];
  ancestry: {
    mixed: boolean;
    primary: CompendiumEntry;
    secondary?: CompendiumEntry;
    features: CompendiumEntry[];
  };
  community: { entry: CompendiumEntry; features: CompendiumEntry[] };
  traits: Record<CharacterTraitName, number>;
  experiences: string[];
  domainCards: Array<CompendiumEntry & { domain: string }>;
  equipment: InventoryItem[];
  character: {
    name: string;
    pronouns: string;
    history: string;
    image?: string;
    appearance?: string;
  };
  companions: Array<{
    id: string;
    name: string;
    role: string;
    appearance: string;
    connection: string;
  }>;
  animalCompanion?: {
    name: string;
    kind: string;
    image?: string;
    appearance?: string;
  };
  armorSlots: number;
};

type Props = {
  ai: NewCampaignAiAdapter;
  onBack: () => void;
  onComplete: (result: NewCampaignResult) => void;
};

const STEP_LABELS = [
  "Tom",
  "Classe",
  "Ancestralidade",
  "Comunidade",
  "Traços",
  "Experiências",
  "Domínios",
  "Equipamento",
  "História",
];

const SOURCE_LABELS = {
  core: "Livro básico",
  expansion: "Expansão",
  playtest: "Teste de jogo",
} as const;

const EQUIPMENT_TYPE_ICONS: Record<string, string> = {
  weapon: "⚔",
  armor: "◈",
  consumable: "✦",
  loot: "◇",
};

function randomId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeJsonText(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseCompanions(text: string): CompanionDraft[] {
  const cleaned = normalizeJsonText(text);
  const candidates = [cleaned];
  const arrayStart = cleaned.indexOf("[");
  const arrayEnd = cleaned.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) candidates.push(cleaned.slice(arrayStart, arrayEnd + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const array = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { companions?: unknown[] }).companions)
          ? (parsed as { companions: unknown[] }).companions
          : [];
      const companions: CompanionDraft[] = [];
      for (const item of array) {
        if (!item || typeof item !== "object") continue;
        const value = item as Record<string, unknown>;
        const name = String(value.name || "").trim();
        const role = String(value.role || "").trim();
        const appearance = String(value.appearance || "").trim();
        if (!name || !role) continue;
        companions.push({ id: randomId("companion"), name, role, appearance: appearance || undefined });
        if (companions.length >= 4) break;
      }
      if (companions.length) return companions;
    } catch {}
  }
  return [];
}

async function fileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File, maxSize = 1024, quality = 0.78) {
  if (!file.type.startsWith("image/")) throw new Error("Escolha um arquivo de imagem.");
  const source = await fileAsDataUrl(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("A imagem não pôde ser aberta."));
    element.src = source;
  });
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível preparar a imagem.");
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

function traitDistributionIsValid(traits: Record<CharacterTraitName, number>) {
  const values = TRAIT_ORDER.map((trait) => traits[trait]).sort((a, b) => a - b);
  const required = [...REQUIRED_TRAIT_VALUES].sort((a, b) => a - b);
  return values.every((value, index) => value === required[index]);
}

function sourceId(entry: CompendiumEntry | undefined) {
  return entry?.sourceId || "";
}

export default function NewCampaignWizard({ ai, onBack, onComplete }: Props) {
  const classes = useMemo(() => classEntries(), []);
  const ancestries = useMemo(() => ancestryEntries(), []);
  const communities = useMemo(() => communityEntries(), []);
  const equipmentEntries = useMemo(
    () => daggerheartCompendium.entries.filter((entry) => entry.category === "equipment"),
    [],
  );

  const [step, setStep] = useState(0);
  const [campaignName, setCampaignName] = useState("");
  const [toneId, setToneId] = useState(TONE_OPTIONS[0]?.id || "heroic");
  const [customTone, setCustomTone] = useState("");

  const [classId, setClassId] = useState("");
  const [subclassId, setSubclassId] = useState("");

  const [mixedAncestry, setMixedAncestry] = useState(false);
  const [ancestryA, setAncestryA] = useState("");
  const [ancestryB, setAncestryB] = useState("");
  const [communityId, setCommunityId] = useState("");

  const [traitMode, setTraitMode] = useState<"suggested" | "manual">("suggested");
  const [traits, setTraits] = useState<Record<CharacterTraitName, number>>({
    agility: 2,
    strength: 1,
    finesse: 1,
    instinct: 0,
    presence: 0,
    knowledge: -1,
  });

  const [experiences, setExperiences] = useState(["", ""]);
  const [domainCards, setDomainCards] = useState<string[]>([]);
  const [equipmentMode, setEquipmentMode] = useState<"suggested" | "manual">("suggested");
  const [equipmentChoiceSelections, setEquipmentChoiceSelections] = useState<number[]>([]);
  const [manualEquipmentIds, setManualEquipmentIds] = useState<Set<string>>(new Set());
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [equipmentTypeFilter, setEquipmentTypeFilter] = useState("all");
  const [customEquipment, setCustomEquipment] = useState("");

  const [characterName, setCharacterName] = useState("");
  const [pronouns, setPronouns] = useState("");
  const [history, setHistory] = useState("");
  const [characterImage, setCharacterImage] = useState("");
  const [appearance, setAppearance] = useState("");
  const [characterImageBusy, setCharacterImageBusy] = useState(false);
  const [characterImageError, setCharacterImageError] = useState("");

  const [companions, setCompanions] = useState<CompanionDraft[]>([]);
  const [companionRelations, setCompanionRelations] = useState<Record<string, string>>({});
  const [companionsBusy, setCompanionsBusy] = useState(false);
  const [companionsError, setCompanionsError] = useState("");
  const companionsAutoStarted = useRef(false);

  const [animalName, setAnimalName] = useState("");
  const [animalKind, setAnimalKind] = useState("");
  const [animalImage, setAnimalImage] = useState("");
  const [animalAppearance, setAnimalAppearance] = useState("");
  const [animalImageBusy, setAnimalImageBusy] = useState(false);
  const [animalImageError, setAnimalImageError] = useState("");

  const selectedClass = classes.find((entry) => sourceId(entry) === classId);
  const subclasses = useMemo(() => (classId ? subclassesFor(classId) : []), [classId]);
  const selectedSubclass = subclasses.find((entry) => sourceId(entry) === subclassId);
  const selectedAncestryA = ancestries.find((entry) => sourceId(entry) === ancestryA);
  const selectedAncestryB = ancestries.find((entry) => sourceId(entry) === ancestryB);
  const selectedCommunity = communities.find((entry) => sourceId(entry) === communityId);
  const primaryAncestryFeatures = useMemo(() => ancestryA ? ancestryFeaturesFor(ancestryA) : [], [ancestryA]);
  const secondaryAncestryFeatures = useMemo(() => ancestryB ? ancestryFeaturesFor(ancestryB) : [], [ancestryB]);
  const selectedCommunityFeatures = useMemo(() => communityId ? communityFeaturesFor(communityId) : [], [communityId]);
  const availableCards = useMemo(() => classId ? levelOneDomainCards(classId) : [], [classId]);
  const selectedClassFeatures = useMemo(() => classId ? classFeaturesFor(classId) : [], [classId]);
  const selectedSubclassFeatures = useMemo(() => subclassId ? subclassFeaturesFor(subclassId) : [], [subclassId]);
  const classConfig = classId ? CLASS_CONFIG[classId] : undefined;
  const isRanger = classId === "Ranger";
  const isBeastbound = isRanger && subclassId === "Beastbound";
  const filteredEquipmentEntries = useMemo(() => {
    const query = equipmentQuery
      .trim()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("pt-BR");
    return equipmentEntries.filter((entry) => {
      if (equipmentTypeFilter !== "all" && entry.type !== equipmentTypeFilter) return false;
      if (!query) return true;
      const text = [entry.name, entry.originalName || "", entry.description, entryTypeLabel(entry.type)]
        .join(" ")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLocaleLowerCase("pt-BR");
      return text.includes(query);
    });
  }, [equipmentEntries, equipmentQuery, equipmentTypeFilter]);

  useEffect(() => {
    if (traitMode !== "suggested" || !classId) return;
    const suggestion = suggestedTraitsFor(classId, subclassId);
    if (suggestion) setTraits({ ...suggestion });
  }, [classId, subclassId, traitMode]);

  useEffect(() => {
    const groups = classConfig?.equipmentChoices || [];
    setEquipmentChoiceSelections(groups.map(() => 0));
    setManualEquipmentIds(new Set());
    setEquipmentQuery("");
    setEquipmentTypeFilter("all");
  }, [classId, classConfig]);

  useEffect(() => {
    if (step !== 8 || !ai.connected || companions.length || companionsBusy || companionsAutoStarted.current) return;
    companionsAutoStarted.current = true;
    void generateCompanions();
  }, [ai.connected, companions.length, companionsBusy, step]);

  function chooseClass(nextClassId: string) {
    setClassId(nextClassId);
    setSubclassId("");
    setDomainCards([]);
    setEquipmentMode("suggested");
  }

  function chooseDomainCard(cardId: string) {
    setDomainCards((current) => {
      if (current.includes(cardId)) return current.filter((id) => id !== cardId);
      if (current.length >= 2) return current;
      return [...current, cardId];
    });
  }

  function updateExperience(index: number, value: string) {
    setExperiences((current) => current.map((entry, entryIndex) => entryIndex === index ? value : entry));
  }

  function updateTrait(trait: CharacterTraitName, value: number) {
    setTraits((current) => ({ ...current, [trait]: value }));
  }

  function toggleManualEquipment(entryId: string) {
    setManualEquipmentIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }

  async function analyzeVisual(image: string, subject: "personagem" | "animal") {
    if (!ai.connected || !ai.model) throw new Error("Conecte o ChatGPT para analisar a imagem.");
    const response = await ai.respond({
      model: ai.model,
      instructions: "Você analisa referências visuais para fichas de RPG. Responda em português brasileiro, em um único parágrafo curto e objetivo. Descreva apenas características visuais estáveis e visíveis. Não invente história, personalidade, poderes ou identidade.",
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: `Descreva a aparência visual deste ${subject} para ser salva na ficha e usada depois pelo Mestre.` },
          { type: "input_image", image_url: image },
        ],
      }],
    });
    const narration = extractNarration(response);
    if (!narration) throw new Error("O ChatGPT não retornou uma descrição visual.");
    return narration;
  }

  async function uploadCharacterImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setCharacterImageBusy(true);
    setCharacterImageError("");
    try {
      const image = await compressImage(file);
      setCharacterImage(image);
      setAppearance("");
    } catch (error) {
      setCharacterImageError(error instanceof Error ? error.message : "Não foi possível processar a imagem.");
    } finally {
      setCharacterImageBusy(false);
    }
  }

  async function analyzeCharacterImage() {
    if (!characterImage) return;
    setCharacterImageBusy(true);
    setCharacterImageError("");
    try {
      setAppearance(await analyzeVisual(characterImage, "personagem"));
    } catch (error) {
      setCharacterImageError(error instanceof Error ? error.message : "Não foi possível analisar a imagem.");
    } finally {
      setCharacterImageBusy(false);
    }
  }

  async function uploadAnimalImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAnimalImageBusy(true);
    setAnimalImageError("");
    try {
      const image = await compressImage(file);
      setAnimalImage(image);
      setAnimalAppearance("");
    } catch (error) {
      setAnimalImageError(error instanceof Error ? error.message : "Não foi possível processar a imagem.");
    } finally {
      setAnimalImageBusy(false);
    }
  }

  async function analyzeAnimalImage() {
    if (!animalImage) return;
    setAnimalImageBusy(true);
    setAnimalImageError("");
    try {
      setAnimalAppearance(await analyzeVisual(animalImage, "animal"));
    } catch (error) {
      setAnimalImageError(error instanceof Error ? error.message : "Não foi possível analisar a imagem.");
    } finally {
      setAnimalImageBusy(false);
    }
  }

  async function generateCompanions() {
    if (!ai.connected || !ai.model) {
      setCompanionsError("Conecte o ChatGPT para criar os companheiros da campanha.");
      return;
    }
    setCompanionsBusy(true);
    setCompanionsError("");
    try {
      const tone = toneId === "custom"
        ? customTone.trim()
        : TONE_OPTIONS.find((toneOption) => toneOption.id === toneId)?.name || "Fantasia heroica";
      const response = await ai.respond({
        model: ai.model,
        instructions: "Você cria companheiros de grupo para uma campanha de Daggerheart. Responda somente JSON válido, sem markdown ou comentários.",
        input: [{
          role: "user",
          content: [
            "Crie exatamente 3 companheiros de grupo distintos e adequados ao personagem abaixo.",
            `Tom: ${tone}.`,
            `Classe: ${selectedClass?.name || classId}.`,
            `Subclasse: ${selectedSubclass?.name || subclassId}.`,
            `Ancestralidade: ${selectedAncestryA?.name || ancestryA}${mixedAncestry && selectedAncestryB ? ` + ${selectedAncestryB.name}` : ""}.`,
            `Comunidade: ${selectedCommunity?.name || communityId}.`,
            `História do personagem: ${history.trim() || "ainda não detalhada"}.`,
            "Use o formato [{\"name\":\"...\",\"role\":\"...\",\"appearance\":\"...\"}].",
            "Role deve dizer a função narrativa e/ou de aventura em uma frase curta. Appearance deve ser uma descrição visual curta.",
          ].join("\n"),
        }],
      });
      const text = extractNarration(response);
      const parsed = parseCompanions(text);
      if (!parsed.length) throw new Error("O ChatGPT retornou companheiros em um formato inesperado. Tente gerar novamente.");
      setCompanions(parsed);
      setCompanionRelations({});
    } catch (error) {
      setCompanionsError(error instanceof Error ? error.message : "Não foi possível criar os companheiros.");
    } finally {
      setCompanionsBusy(false);
    }
  }

  const stepValid = useMemo(() => {
    if (step === 0) return toneId !== "custom" || Boolean(customTone.trim());
    if (step === 1) return Boolean(classId && subclassId);
    if (step === 2) {
      if (!ancestryA) return false;
      if (!mixedAncestry) return primaryAncestryFeatures.length > 0;
      return Boolean(ancestryB && ancestryA !== ancestryB && primaryAncestryFeatures[0] && secondaryAncestryFeatures[1]);
    }
    if (step === 3) return Boolean(communityId);
    if (step === 4) return traitDistributionIsValid(traits);
    if (step === 5) return experiences.every((experience) => Boolean(experience.trim()));
    if (step === 6) return domainCards.length === 2;
    if (step === 7) {
      if (!classConfig) return false;
      if (equipmentMode === "suggested") return true;
      return manualEquipmentIds.size > 0 || Boolean(customEquipment.trim());
    }
    if (step === 8) {
      return Boolean(characterName.trim() && history.trim()) && !characterImageBusy && !animalImageBusy;
    }
    return false;
  }, [
    ancestryA,
    ancestryB,
    characterImageBusy,
    characterName,
    classConfig,
    customEquipment,
    classId,
    communityId,
    customTone,
    domainCards.length,
    equipmentMode,
    experiences,
    history,
    manualEquipmentIds,
    mixedAncestry,
    animalImageBusy,
    primaryAncestryFeatures,
    secondaryAncestryFeatures,
    step,
    subclassId,
    toneId,
    traits,
  ]);

  function equipmentResult(): InventoryItem[] {
    if (!classConfig) return [];
    const sourceItems = equipmentMode === "suggested"
      ? [
          ...classConfig.suggestedEquipment,
          ...(classConfig.equipmentChoices || []).flatMap((group, groupIndex) => {
            const index = equipmentChoiceSelections[groupIndex] || 0;
            return group[index] ? [group[index]] : [];
          }),
        ]
      : [
          ...equipmentEntries
            .filter((entry) => manualEquipmentIds.has(entry.id))
            .map((entry) => ({
              name: entry.name,
              qty: 1,
              detail: entry.description || entryTypeLabel(entry.type),
              icon: EQUIPMENT_TYPE_ICONS[entry.type] || "◇",
            })),
          ...(() => {
            const line = customEquipment.trim();
            if (!line) return [];
            const [name, ...detailParts] = line.split("|");
            if (!name.trim()) return [];
            return [{
              name: name.trim(),
              qty: 1,
              detail: detailParts.join("|").trim() || "Equipamento personalizado",
              icon: "◇",
            }];
          })(),
        ];
    return sourceItems.map((item) => ({ ...item, id: randomId("item") }));
  }

  function finish() {
    if (!stepValid || !selectedClass || !selectedSubclass || !selectedAncestryA || !selectedCommunity || !classConfig) return;

    const ancestryFeatures = mixedAncestry
      ? [primaryAncestryFeatures[0], secondaryAncestryFeatures[1]].filter(Boolean)
      : primaryAncestryFeatures;
    const cards = availableCards.filter((card) => domainCards.includes(card.id));
    const equipment = equipmentResult();

    const tone = toneId === "custom"
      ? customTone.trim()
      : TONE_OPTIONS.find((toneOption) => toneOption.id === toneId)?.name || "Fantasia heroica";
    onComplete({
      campaignName: campaignName.trim() || "Nova campanha",
      tone,
      system: "Daggerheart",
      classEntry: selectedClass,
      subclassEntry: selectedSubclass,
      classFeatures: selectedClassFeatures,
      subclassFeatures: selectedSubclassFeatures,
      ancestry: {
        mixed: mixedAncestry,
        primary: selectedAncestryA,
        ...(mixedAncestry && selectedAncestryB ? { secondary: selectedAncestryB } : {}),
        features: ancestryFeatures,
      },
      community: { entry: selectedCommunity, features: selectedCommunityFeatures },
      traits: { ...traits },
      experiences: experiences.map((experience) => experience.trim()),
      domainCards: cards,
      equipment,
      character: {
        name: characterName.trim(),
        pronouns: pronouns.trim(),
        history: history.trim(),
        image: characterImage || undefined,
        appearance: appearance || undefined,
      },
      companions: companions.map((companion) => ({
        id: companion.id,
        name: companion.name,
        role: companion.role,
        appearance: companion.appearance || "",
        connection: (companionRelations[companion.id] || "").trim(),
      })),
      ...(isRanger && (animalName.trim() || animalKind.trim() || animalImage || animalAppearance.trim()) ? {
        animalCompanion: {
          name: animalName.trim() || "Companheiro animal",
          kind: animalKind.trim(),
          image: animalImage || undefined,
          appearance: animalAppearance || undefined,
        },
      } : {}),
      armorSlots: armorSlotsFromItems(equipment),
    });
  }

  const toneName = toneId === "custom"
    ? customTone.trim() || "Personalizado"
    : TONE_OPTIONS.find((tone) => tone.id === toneId)?.name || "—";
  const selectedDomains = classConfig?.domains || [];

  return (
    <main className="campaignWizardShell">
      <div className="campaignWizardAmbient campaignWizardAmbientA" />
      <div className="campaignWizardAmbient campaignWizardAmbientB" />
      <header className="campaignWizardHeader">
        <button className="campaignWizardBack" onClick={onBack} aria-label="Voltar">‹</button>
        <div>
          <small>NOVA CAMPANHA</small>
          <strong>Daggerheart</strong>
        </div>
        <span>{step + 1} / {STEP_LABELS.length}</span>
      </header>

      <div className="campaignWizardProgress" aria-label="Etapas da criação">
        {STEP_LABELS.map((label, index) => (
          <button
            key={label}
            className={`${index === step ? "active" : ""} ${index < step ? "done" : ""}`}
            onClick={() => index < step && setStep(index)}
            disabled={index > step}
          >
            <i>{index < step ? "✓" : index + 1}</i>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="campaignWizardLayout">
        <section className="campaignWizardCard">
          {step === 0 && (
            <div className="campaignWizardStep">
              <div className="campaignWizardIntro">
                <small>PASSO 1</small>
                <h1>Que história vocês querem viver?</h1>
                <p>O tom orienta o Mestre IA desde a primeira cena. Este criador usa as regras de Daggerheart.</p>
              </div>
              <label className="campaignWizardField">
                <span>Nome da campanha <em>opcional</em></span>
                <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Ex.: As Crônicas de Eryndor" />
              </label>
              <div className="campaignWizardSystemCard">
                <span className="campaignWizardGlyph">✦</span>
                <div><small>SISTEMA</small><strong>Daggerheart</strong><p>Criação de personagem, domínios, esperança e medo.</p></div>
                <b>ATIVO</b>
              </div>
              <div className="campaignWizardChoiceGrid toneGrid">
                {TONE_OPTIONS.map((tone) => (
                  <button className={toneId === tone.id ? "selected" : ""} onClick={() => setToneId(tone.id)} key={tone.id}>
                    <strong>{tone.name}</strong>
                    <span>{tone.description}</span>
                  </button>
                ))}
              </div>
              {toneId === "custom" && (
                <label className="campaignWizardField">
                  <span>Descreva o tom</span>
                  <textarea value={customTone} onChange={(event) => setCustomTone(event.target.value)} placeholder="Ex.: fantasia de fronteira, melancólica, com descobertas antigas e humor entre o grupo." />
                </label>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="campaignWizardStep">
              <div className="campaignWizardIntro"><small>PASSO 2</small><h1>Escolha sua classe.</h1><p>A classe define seus dois domínios e oferece os traços e equipamentos sugeridos usados nos próximos passos.</p></div>
              <div className="campaignWizardChoiceGrid classGrid">
                {classes.map((entry) => {
                  const id = sourceId(entry);
                  const config = CLASS_CONFIG[id];
                  return (
                    <button className={classId === id ? "selected" : ""} onClick={() => chooseClass(id)} key={entry.id}>
                      <div className="campaignWizardOptionMeta">
                        <span>{SOURCE_LABELS[config.source]}</span>
                        {config.source === "playtest" && <em>PLAYTEST</em>}
                      </div>
                      <strong>{entry.name}</strong>
                      <p>{entry.description}</p>
                      <small>{config.domains.join(" · ")}</small>
                    </button>
                  );
                })}
              </div>
              {classId && (
                <div className="campaignWizardSubsection">
                  <div className="campaignWizardSectionTitle"><small>SUBCLASSE</small><strong>Qual caminho você segue?</strong></div>
                  <div className="campaignWizardChoiceGrid compactGrid">
                    {subclasses.map((entry) => {
                      const id = sourceId(entry);
                      return <button className={subclassId === id ? "selected" : ""} onClick={() => setSubclassId(id)} key={entry.id}><strong>{entry.name}</strong><span>{entry.description}</span></button>;
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="campaignWizardStep">
              <div className="campaignWizardIntro"><small>PASSO 3</small><h1>De onde vem seu sangue?</h1><p>Você pode escolher uma ancestralidade ou criar uma ancestralidade mista pelas regras de Daggerheart.</p></div>
              <div className="campaignWizardModeSwitch">
                <button className={!mixedAncestry ? "active" : ""} onClick={() => { setMixedAncestry(false); setAncestryB(""); }}>Uma ancestralidade</button>
                <button className={mixedAncestry ? "active" : ""} onClick={() => setMixedAncestry(true)}>Ancestralidade mista</button>
              </div>
              {mixedAncestry && <div className="campaignWizardRuleNote"><b>Regra mista</b><span>Você recebe a primeira característica da Ancestralidade A e a segunda característica da Ancestralidade B.</span></div>}
              <div className="campaignWizardSectionTitle"><small>{mixedAncestry ? "ANCESTRALIDADE A" : "ANCESTRALIDADE"}</small><strong>{mixedAncestry ? "Escolha a origem da primeira característica" : "Escolha sua ancestralidade"}</strong></div>
              <div className="campaignWizardChoiceGrid ancestryGrid">
                {ancestries.map((entry) => {
                  const id = sourceId(entry);
                  return <button className={ancestryA === id ? "selected" : ""} onClick={() => { setAncestryA(id); if (ancestryB === id) setAncestryB(""); }} key={entry.id}><strong>{entry.name}</strong><span>{entry.description}</span></button>;
                })}
              </div>
              {selectedAncestryA && (
                <div className="campaignWizardFeaturePreview">
                  {(mixedAncestry ? primaryAncestryFeatures.slice(0, 1) : primaryAncestryFeatures).map((feature) => <div key={feature.id}><small>{mixedAncestry ? "CARACTERÍSTICA 1" : "CARACTERÍSTICA"}</small><strong>{feature.name}</strong><p>{feature.description}</p></div>)}
                </div>
              )}
              {mixedAncestry && ancestryA && (
                <>
                  <div className="campaignWizardSectionTitle"><small>ANCESTRALIDADE B</small><strong>Escolha a origem da segunda característica</strong></div>
                  <div className="campaignWizardChoiceGrid ancestryGrid">
                    {ancestries.filter((entry) => sourceId(entry) !== ancestryA).map((entry) => {
                      const id = sourceId(entry);
                      return <button className={ancestryB === id ? "selected" : ""} onClick={() => setAncestryB(id)} key={entry.id}><strong>{entry.name}</strong><span>{entry.description}</span></button>;
                    })}
                  </div>
                  {selectedAncestryB && secondaryAncestryFeatures[1] && (
                    <div className="campaignWizardFeaturePreview"><div><small>CARACTERÍSTICA 2</small><strong>{secondaryAncestryFeatures[1].name}</strong><p>{secondaryAncestryFeatures[1].description}</p></div></div>
                  )}
                </>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="campaignWizardStep">
              <div className="campaignWizardIntro"><small>PASSO 4</small><h1>Quem ensinou você a viver?</h1><p>Sua comunidade representa a cultura e o ambiente que moldaram sua forma de encarar o mundo.</p></div>
              <div className="campaignWizardChoiceGrid communityGrid">
                {communities.map((entry) => {
                  const id = sourceId(entry);
                  return <button className={communityId === id ? "selected" : ""} onClick={() => setCommunityId(id)} key={entry.id}><strong>{entry.name}</strong><span>{entry.description}</span></button>;
                })}
              </div>
              {selectedCommunity && selectedCommunityFeatures.length > 0 && (
                <div className="campaignWizardFeaturePreview">{selectedCommunityFeatures.map((feature) => <div key={feature.id}><small>CARACTERÍSTICA DE COMUNIDADE</small><strong>{feature.name}</strong><p>{feature.description}</p></div>)}</div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="campaignWizardStep">
              <div className="campaignWizardIntro"><small>PASSO 5</small><h1>Defina seus traços.</h1><p>Distribua exatamente +2, +1, +1, 0, 0 e −1. Você pode usar a sugestão da sua classe ou montar a combinação manualmente.</p></div>
              <div className="campaignWizardModeSwitch">
                <button className={traitMode === "suggested" ? "active" : ""} onClick={() => setTraitMode("suggested")}>Sugestão da classe</button>
                <button className={traitMode === "manual" ? "active" : ""} onClick={() => setTraitMode("manual")}>Escolher manualmente</button>
              </div>
              <div className="campaignWizardTraits">
                {TRAIT_ORDER.map((trait) => (
                  <label key={trait}>
                    <span>{TRAIT_LABELS[trait]}</span>
                    {traitMode === "manual" ? (
                      <select value={traits[trait]} onChange={(event) => updateTrait(trait, Number(event.target.value))}>
                        {[-1, 0, 1, 2].map((value) => <option value={value} key={value}>{value > 0 ? `+${value}` : value}</option>)}
                      </select>
                    ) : <strong>{traits[trait] > 0 ? `+${traits[trait]}` : traits[trait]}</strong>}
                  </label>
                ))}
              </div>
              <div className={`campaignWizardValidation ${traitDistributionIsValid(traits) ? "valid" : "invalid"}`}>
                <span>{traitDistributionIsValid(traits) ? "✓" : "!"}</span>
                {traitDistributionIsValid(traits) ? "Distribuição válida." : "A distribuição precisa conter +2, +1, +1, 0, 0 e −1 exatamente uma vez cada posição."}
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="campaignWizardStep">
              <div className="campaignWizardIntro"><small>PASSO 6</small><h1>O que sua vida já lhe ensinou?</h1><p>Escreva duas experiências iniciais. Cada uma começa com bônus +2 e pode ser usada quando for relevante para a ação.</p></div>
              <div className="campaignWizardExperienceList">
                {experiences.map((experience, index) => (
                  <label key={index}>
                    <b>+2</b>
                    <div><span>Experiência {index + 1}</span><input value={experience} onChange={(event) => updateExperience(index, event.target.value)} placeholder={index === 0 ? "Ex.: Criado entre caçadores" : "Ex.: Conheço ruínas antigas"} /></div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="campaignWizardStep">
              <div className="campaignWizardIntro"><small>PASSO 7</small><h1>Escolha duas cartas de domínio.</h1><p>Sua classe tem acesso aos domínios {selectedDomains.join(" e ")}. Selecione exatamente duas cartas de nível 1.</p></div>
              <div className="campaignWizardDomainCount"><strong>{domainCards.length}</strong><span>/ 2 escolhidas</span></div>
              <div className="campaignWizardDomainGrid">
                {availableCards.map((card) => (
                  <button className={domainCards.includes(card.id) ? "selected" : ""} onClick={() => chooseDomainCard(card.id)} key={card.id}>
                    <small>{card.domain} · NÍVEL 1</small>
                    <strong>{card.name}</strong>
                    <p>{card.description}</p>
                    <span>{domainCards.includes(card.id) ? "✓ Escolhida" : "Selecionar"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 7 && classConfig && (
            <div className="campaignWizardStep">
              <div className="campaignWizardIntro"><small>PASSO 8</small><h1>Prepare seu equipamento.</h1><p>Use o conjunto inicial sugerido para sua classe ou personalize a carga antes da primeira cena.</p></div>
              <div className="campaignWizardModeSwitch">
                <button className={equipmentMode === "suggested" ? "active" : ""} onClick={() => setEquipmentMode("suggested")}>Conjunto sugerido</button>
                <button className={equipmentMode === "manual" ? "active" : ""} onClick={() => setEquipmentMode("manual")}>Escolher manualmente</button>
              </div>
              {equipmentMode === "suggested" ? (
                <>
                  <div className="campaignWizardEquipmentList">
                    {classConfig.suggestedEquipment.map((item, index) => (
                      <label key={`${item.name}-${index}`}>
                        <span>{item.icon}</span>
                        <div><strong>{item.name}</strong><small>{item.detail}</small></div>
                        <b>×{item.qty}</b>
                      </label>
                    ))}
                  </div>
                  {(classConfig.equipmentChoices || []).map((group, groupIndex) => (
                    <div className="campaignWizardEquipmentChoice" key={groupIndex}>
                      <small>ESCOLHA 1 ITEM</small>
                      <div>{group.map((item, itemIndex) => <button className={(equipmentChoiceSelections[groupIndex] || 0) === itemIndex ? "selected" : ""} onClick={() => setEquipmentChoiceSelections((current) => current.map((value, index) => index === groupIndex ? itemIndex : value))} key={item.name}><span>{item.icon}</span><strong>{item.name}</strong></button>)}</div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="campaignWizardEquipmentBrowser">
                  <div className="campaignWizardEquipmentBrowserHeader">
                    <div><small>COMPÊNDIO</small><strong>Escolha seus itens</strong></div>
                    <span>{manualEquipmentIds.size} {manualEquipmentIds.size === 1 ? "selecionado" : "selecionados"}</span>
                  </div>
                  <label className="campaignWizardEquipmentSearch">
                    <span>⌕</span>
                    <input value={equipmentQuery} onChange={(event) => setEquipmentQuery(event.target.value)} placeholder="Buscar equipamento…" />
                    {equipmentQuery && <button onClick={() => setEquipmentQuery("")} type="button">×</button>}
                  </label>
                  <div className="campaignWizardEquipmentFilters">
                    {["all", "weapon", "armor", "consumable", "loot"].map((type) => (
                      <button
                        className={equipmentTypeFilter === type ? "active" : ""}
                        key={type}
                        onClick={() => setEquipmentTypeFilter(type)}
                        type="button"
                      >
                        {type === "all" ? "Todos" : entryTypeLabel(type)}
                      </button>
                    ))}
                  </div>
                  <div className="campaignWizardEquipmentCatalog">
                    {filteredEquipmentEntries.map((entry) => (
                      <label className={manualEquipmentIds.has(entry.id) ? "selected" : ""} key={entry.id}>
                        <input type="checkbox" checked={manualEquipmentIds.has(entry.id)} onChange={() => toggleManualEquipment(entry.id)} />
                        <span>{EQUIPMENT_TYPE_ICONS[entry.type] || "◇"}</span>
                        <div>
                          <small>{entryTypeLabel(entry.type)}</small>
                          <strong>{entry.name}</strong>
                          <p>{entry.description || "Sem descrição no compêndio."}</p>
                        </div>
                      </label>
                    ))}
                    {!filteredEquipmentEntries.length && <div className="campaignWizardEquipmentEmpty">Nenhum equipamento encontrado.</div>}
                  </div>
                  <label className="campaignWizardField campaignWizardCustomEquipment">
                    <span>Item personalizado <em>opcional · Nome | detalhe</em></span>
                    <input value={customEquipment} onChange={(event) => setCustomEquipment(event.target.value)} placeholder="Ex.: Amuleto antigo | Lembrança de família" />
                  </label>
                </div>
              )}
            </div>
          )}

          {step === 8 && (
            <div className="campaignWizardStep">
              <div className="campaignWizardIntro"><small>PASSO 9</small><h1>Dê vida ao personagem.</h1><p>Conte quem ele é, adicione uma referência visual e defina os vínculos que já existem quando a campanha começar.</p></div>
              {!ai.connected && (
                <div className="campaignWizardAiNotice">
                  <div><small>CHATGPT DESCONECTADO</small><strong>Conecte para analisar imagens e criar os companheiros do grupo.</strong></div>
                  <button onClick={() => void ai.onConnect()}>Conectar ChatGPT</button>
                </div>
              )}
              <div className="campaignWizardIdentityGrid">
                <label className="campaignWizardField"><span>Nome do personagem</span><input value={characterName} onChange={(event) => setCharacterName(event.target.value)} placeholder="Nome" /></label>
                <label className="campaignWizardField"><span>Pronomes <em>opcional</em></span><input value={pronouns} onChange={(event) => setPronouns(event.target.value)} placeholder="Ex.: ela/dela" /></label>
              </div>
              <label className="campaignWizardField"><span>História do personagem</span><textarea value={history} onChange={(event) => setHistory(event.target.value)} placeholder="De onde veio, o que procura, o que deixou para trás e por que está com este grupo?" /></label>

              <div className="campaignWizardImageBlock">
                <div className="campaignWizardSectionTitle"><small>REFERÊNCIA VISUAL</small><strong>Imagem do personagem</strong></div>
                <div className="campaignWizardUploadRow">
                  <div className={`campaignWizardImagePreview ${characterImage ? "hasImage" : ""}`}>{characterImage ? <img src={characterImage} alt="Referência do personagem" /> : <span>◈</span>}</div>
                  <div>
                    <p>Envie uma imagem como referência. Depois, peça ao ChatGPT para registrar a descrição visual sem precisar escrevê-la à mão.</p>
                    <div className="campaignWizardUploadActions">
                      <label className="campaignWizardUploadButton">{characterImageBusy ? "Processando…" : characterImage ? "Trocar imagem" : "Escolher imagem"}<input type="file" accept="image/*" onChange={uploadCharacterImage} disabled={characterImageBusy} /></label>
                      {characterImage && (ai.connected
                        ? <button className="campaignWizardAiButton" onClick={analyzeCharacterImage} disabled={characterImageBusy}>{characterImageBusy ? "Analisando…" : appearance ? "Analisar novamente" : "Analisar com ChatGPT"}</button>
                        : <button className="campaignWizardAiButton" onClick={() => void ai.onConnect()}>Conectar ChatGPT</button>)}
                    </div>
                  </div>
                </div>
                {appearance && <div className="campaignWizardAnalysis"><small>APARÊNCIA REGISTRADA</small><p>{appearance}</p></div>}
                {characterImageError && <p className="campaignWizardError">{characterImageError}</p>}
              </div>

              {isRanger && (
                <div className="campaignWizardAnimalBlock">
                  <div className="campaignWizardSectionTitle">
                    <small>RANGER{isBeastbound ? " · TREINADOR" : " · OPCIONAL"}</small>
                    <strong>Companheiro animal</strong>
                  </div>
                  {!isBeastbound && <p className="campaignWizardHint">Para a subclasse Treinador, o companheiro animal faz parte das regras da subclasse. Em outros Patrulheiros, esta referência é apenas narrativa.</p>}
                  <div className="campaignWizardIdentityGrid">
                    <label className="campaignWizardField"><span>Nome</span><input value={animalName} onChange={(event) => setAnimalName(event.target.value)} placeholder="Nome do animal" /></label>
                    <label className="campaignWizardField"><span>Tipo <em>opcional</em></span><input value={animalKind} onChange={(event) => setAnimalKind(event.target.value)} placeholder="Ex.: lobo, falcão, lagarto" /></label>
                  </div>
                  <div className="campaignWizardUploadRow">
                    <div className={`campaignWizardImagePreview animal ${animalImage ? "hasImage" : ""}`}>{animalImage ? <img src={animalImage} alt="Referência do companheiro animal" /> : <span>✦</span>}</div>
                    <div>
                      <p>Você também pode usar uma imagem para registrar a aparência do companheiro.</p>
                      <div className="campaignWizardUploadActions">
                        <label className="campaignWizardUploadButton">{animalImageBusy ? "Processando…" : animalImage ? "Trocar imagem" : "Escolher imagem"}<input type="file" accept="image/*" onChange={uploadAnimalImage} disabled={animalImageBusy} /></label>
                        {animalImage && (ai.connected
                          ? <button className="campaignWizardAiButton" onClick={analyzeAnimalImage} disabled={animalImageBusy}>{animalImageBusy ? "Analisando…" : animalAppearance ? "Analisar novamente" : "Analisar com ChatGPT"}</button>
                          : <button className="campaignWizardAiButton" onClick={() => void ai.onConnect()}>Conectar ChatGPT</button>)}
                      </div>
                    </div>
                  </div>
                  {animalAppearance && <div className="campaignWizardAnalysis"><small>APARÊNCIA DO ANIMAL</small><p>{animalAppearance}</p></div>}
                  {animalImageError && <p className="campaignWizardError">{animalImageError}</p>}
                </div>
              )}

              <div className="campaignWizardCompanions">
                <div className="campaignWizardCompanionHeader">
                  <div className="campaignWizardSectionTitle"><small>COMPANHEIROS</small><strong>Quem começa esta história ao seu lado?</strong></div>
                  <button onClick={() => ai.connected ? void generateCompanions() : void ai.onConnect()} disabled={companionsBusy}>{!ai.connected ? "Conectar ChatGPT" : companionsBusy ? "Criando…" : companions.length ? "Gerar novamente" : "Criar com ChatGPT"}</button>
                </div>
                <p className="campaignWizardHint">Depois de gerar o grupo, você pode registrar um vínculo prévio com qualquer companheiro. Se deixar em branco, vocês acabaram de se conhecer.</p>
                {companionsError && <p className="campaignWizardError">{companionsError}</p>}
                {companions.length > 0 && <div className="campaignWizardCompanionList">{companions.map((companion) => (
                  <article key={companion.id}>
                    <div className="campaignWizardCompanionAvatar">{companion.name.slice(0, 1).toUpperCase()}</div>
                    <div className="campaignWizardCompanionBody"><strong>{companion.name}</strong><small>{companion.role}</small>{companion.appearance && <p>{companion.appearance}</p>}<label><span>Seu vínculo <em>opcional</em></span><input value={companionRelations[companion.id] || ""} onChange={(event) => setCompanionRelations((current) => ({ ...current, [companion.id]: event.target.value }))} placeholder="Ex.: crescemos na mesma vila" /></label></div>
                  </article>
                ))}</div>}
              </div>
            </div>
          )}

          <footer className="campaignWizardFooter">
            <button className="campaignWizardSecondary" onClick={() => step === 0 ? onBack() : setStep((current) => Math.max(0, current - 1))}>{step === 0 ? "Cancelar" : "Voltar"}</button>
            {step < STEP_LABELS.length - 1
              ? <button className="campaignWizardPrimary" disabled={!stepValid} onClick={() => stepValid && setStep((current) => Math.min(STEP_LABELS.length - 1, current + 1))}>Continuar <span>→</span></button>
              : <button className="campaignWizardPrimary" disabled={!stepValid} onClick={finish}>Criar campanha <span>✦</span></button>}
          </footer>
        </section>

        <aside className="campaignWizardSummary">
          <small>SEU PERSONAGEM</small>
          <div className="campaignWizardSummaryPortrait">{characterImage ? <img src={characterImage} alt="" /> : <span>◈</span>}</div>
          <h2>{characterName.trim() || "Novo personagem"}</h2>
          <p>{selectedClass ? `${selectedClass.name}${selectedSubclass ? ` · ${selectedSubclass.name}` : ""}` : "Escolha uma classe"}</p>
          <dl>
            <div><dt>Tom</dt><dd>{toneName}</dd></div>
            <div><dt>Ancestralidade</dt><dd>{selectedAncestryA ? `${selectedAncestryA.name}${mixedAncestry && selectedAncestryB ? ` + ${selectedAncestryB.name}` : ""}` : "—"}</dd></div>
            <div><dt>Comunidade</dt><dd>{selectedCommunity?.name || "—"}</dd></div>
            <div><dt>Domínios</dt><dd>{selectedDomains.length ? selectedDomains.join(" · ") : "—"}</dd></div>
          </dl>
          <div className="campaignWizardSummaryTraits">{TRAIT_ORDER.map((trait) => <span key={trait}><small>{TRAIT_LABELS[trait].slice(0, 3).toUpperCase()}</small><b>{traits[trait] > 0 ? `+${traits[trait]}` : traits[trait]}</b></span>)}</div>
        </aside>
      </div>
    </main>
  );
}
