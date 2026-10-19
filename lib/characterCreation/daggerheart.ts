import { daggerheartCompendium, type CompendiumEntry } from "@/lib/compendium/daggerheart";
import type { CharacterTraitName, InventoryItem } from "@/lib/game";

export type ToneOption = {
  id: string;
  name: string;
  description: string;
};

export type ClassCreationConfig = {
  id: string;
  domains: [string, string];
  source: "core" | "expansion" | "playtest";
  suggestedTraits: Record<CharacterTraitName, number>;
  suggestedEquipment: Array<Omit<InventoryItem, "id">>;
  equipmentChoices?: Array<Array<Omit<InventoryItem, "id">>>;
};

export const TRAIT_LABELS: Record<CharacterTraitName, string> = {
  agility: "Agilidade",
  strength: "Força",
  finesse: "Acuidade",
  instinct: "Instinto",
  presence: "Presença",
  knowledge: "Conhecimento",
};

export const TRAIT_ORDER: CharacterTraitName[] = [
  "agility",
  "strength",
  "finesse",
  "instinct",
  "presence",
  "knowledge",
];

export const REQUIRED_TRAIT_VALUES = [-1, 0, 0, 1, 1, 2];

export const TONE_OPTIONS: ToneOption[] = [
  { id: "heroic", name: "Fantasia heroica", description: "Grandes feitos, esperança e ameaças dignas de lendas." },
  { id: "dark", name: "Fantasia sombria", description: "Escolhas difíceis, perigos reais e vitórias conquistadas a custo." },
  { id: "mystery", name: "Mistério e exploração", description: "Segredos, ruínas, descobertas e perguntas sem respostas fáceis." },
  { id: "intrigue", name: "Intriga e política", description: "Facções, alianças, reputação e conflitos de interesses." },
  { id: "horror", name: "Horror e tensão", description: "Atmosfera inquietante, suspense e ameaças que desafiam a coragem." },
  { id: "wonder", name: "Aventura maravilhosa", description: "Descoberta, humor, lugares fantásticos e espírito de aventura." },
  { id: "custom", name: "Personalizado", description: "Defina o tom com suas próprias palavras." },
];

const commonPack: Array<Omit<InventoryItem, "id">> = [
  { name: "Tocha", qty: 1, detail: "Equipamento de viagem", icon: "✦" },
  { name: "Corda", qty: 1, detail: "15 metros", icon: "⌁" },
  { name: "Suprimentos básicos", qty: 1, detail: "Kit de aventura", icon: "◇" },
  { name: "Punhado de ouro", qty: 1, detail: "Dinheiro inicial", icon: "◉" },
  { name: "Poção de Vida Menor", qty: 1, detail: "Consumível inicial", icon: "◒" },
];

function weapon(name: string, detail: string): Omit<InventoryItem, "id"> {
  return { name, qty: 1, detail, icon: "⚔" };
}

function armor(name: string, detail: string): Omit<InventoryItem, "id"> {
  return { name, qty: 1, detail, icon: "⬡" };
}

function trinket(name: string, detail = "Item inicial de classe"): Omit<InventoryItem, "id"> {
  return { name, qty: 1, detail, icon: "✦" };
}

export const CLASS_CONFIG: Record<string, ClassCreationConfig> = {
  Bard: {
    id: "Bard",
    domains: ["Codex", "Grace"],
    source: "core",
    suggestedTraits: { agility: 0, strength: -1, finesse: 1, instinct: 0, presence: 2, knowledge: 1 },
    suggestedEquipment: [
      weapon("Rapieira", "Presença · Corpo-a-Corpo · d8 físico · uma mão"),
      weapon("Adaga pequena", "Acuidade · Corpo-a-Corpo · d8 físico"),
      armor("Gambesão", "Limiares 5/11 · Armadura 3 · Flexível (+1 Evasão)"),
      ...commonPack,
    ],
    equipmentChoices: [[trinket("Romance"), trinket("Carta nunca aberta")]],
  },
  Druid: {
    id: "Druid",
    domains: ["Arcana", "Sage"],
    source: "core",
    suggestedTraits: { agility: 1, strength: 0, finesse: 1, instinct: 2, presence: -1, knowledge: 0 },
    suggestedEquipment: [
      weapon("Bastão curto", "Instinto · Próximo · d8+1 mágico · uma mão"),
      weapon("Escudo redondo", "Força · Corpo-a-Corpo · d4 físico · Protetor"),
      armor("Couro", "Limiares 6/13 · Armadura 3"),
      ...commonPack,
    ],
    equipmentChoices: [[trinket("Bolsa de pedras e ossos"), trinket("Pingente estranho encontrado na terra")]],
  },
  Guardian: {
    id: "Guardian",
    domains: ["Blade", "Valor"],
    source: "core",
    suggestedTraits: { agility: 1, strength: 2, finesse: -1, instinct: 0, presence: 1, knowledge: 0 },
    suggestedEquipment: [
      weapon("Machado de batalha", "Força · Corpo-a-Corpo · d10+3 físico · duas mãos"),
      armor("Cota de malha", "Limiares 7/15 · Armadura 4 · Pesada"),
      ...commonPack,
    ],
  },
  Ranger: {
    id: "Ranger",
    domains: ["Bone", "Sage"],
    source: "core",
    suggestedTraits: { agility: 2, strength: 0, finesse: 1, instinct: 1, presence: -1, knowledge: 0 },
    suggestedEquipment: [
      weapon("Arco curto", "Agilidade · Distante · d6+3 físico · duas mãos"),
      armor("Couro", "Limiares 6/13 · Armadura 3"),
      ...commonPack,
    ],
    equipmentChoices: [[trinket("Troféu da primeira caçada"), trinket("Bússola aparentemente quebrada")]],
  },
  Rogue: {
    id: "Rogue",
    domains: ["Grace", "Midnight"],
    source: "core",
    suggestedTraits: { agility: 1, strength: -1, finesse: 2, instinct: 0, presence: 1, knowledge: 0 },
    suggestedEquipment: [
      weapon("Adaga", "Acuidade · Corpo-a-Corpo · d8+1 físico · uma mão"),
      weapon("Adaga pequena", "Acuidade · Corpo-a-Corpo · d8 físico"),
      armor("Gambesão", "Limiares 5/11 · Armadura 3 · Flexível (+1 Evasão)"),
      ...commonPack,
    ],
    equipmentChoices: [[trinket("Ferramentas de falsificação"), trinket("Gancho de escalada")]],
  },
  Seraph: {
    id: "Seraph",
    domains: ["Splendor", "Valor"],
    source: "core",
    suggestedTraits: { agility: 0, strength: 2, finesse: 0, instinct: 1, presence: 1, knowledge: -1 },
    suggestedEquipment: [
      weapon("Machado sagrado", "Força · Corpo-a-Corpo · d8+1 mágico · uma mão"),
      weapon("Escudo redondo", "Força · Corpo-a-Corpo · d4 físico · Protetor"),
      armor("Cota de malha", "Limiares 7/15 · Armadura 4 · Pesada"),
      ...commonPack,
    ],
    equipmentChoices: [[trinket("Conjunto de oferendas"), trinket("Símbolo da divindade")]],
  },
  Sorcerer: {
    id: "Sorcerer",
    domains: ["Arcana", "Midnight"],
    source: "core",
    suggestedTraits: { agility: 0, strength: -1, finesse: 1, instinct: 2, presence: 1, knowledge: 0 },
    suggestedEquipment: [
      weapon("Bastão duplo", "Instinto · Distante · d6+3 mágico · duas mãos"),
      armor("Gambesão", "Limiares 5/11 · Armadura 3 · Flexível (+1 Evasão)"),
      ...commonPack,
    ],
    equipmentChoices: [[trinket("Orbe sussurrante"), trinket("Relíquia de família")]],
  },
  Warrior: {
    id: "Warrior",
    domains: ["Blade", "Bone"],
    source: "core",
    suggestedTraits: { agility: 2, strength: 1, finesse: 0, instinct: 1, presence: -1, knowledge: 0 },
    suggestedEquipment: [
      weapon("Espada longa", "Agilidade · Corpo-a-Corpo · d10+3 físico"),
      armor("Cota de malha", "Limiares 7/15 · Armadura 4 · Pesada"),
      ...commonPack,
    ],
    equipmentChoices: [[trinket("Desenho de alguém amado"), trinket("Pedra de amolar")]],
  },
  Wizard: {
    id: "Wizard",
    domains: ["Codex", "Splendor"],
    source: "core",
    suggestedTraits: { agility: -1, strength: 0, finesse: 0, instinct: 1, presence: 1, knowledge: 2 },
    suggestedEquipment: [
      weapon("Cajado grande", "Conhecimento · Muito Distante · d6 mágico · Poderoso"),
      armor("Couro", "Limiares 6/13 · Armadura 3"),
      ...commonPack,
    ],
    equipmentChoices: [[trinket("Livro não traduzido"), trinket("Pequeno elemental inofensivo")]],
  },
  Assassin: {
    id: "Assassin",
    domains: ["Midnight", "Blade"],
    source: "expansion",
    suggestedTraits: { agility: 1, strength: -1, finesse: 2, instinct: 1, presence: 0, knowledge: 0 },
    suggestedEquipment: [
      weapon("Adaga", "Acuidade · Corpo-a-Corpo · d8+1 físico · uma mão"),
      weapon("Besta de mão", "Acuidade · Distante · d6+1 físico"),
      armor("Couro", "Limiares 6/13 · Armadura 3"),
      ...commonPack,
    ],
    equipmentChoices: [[trinket("Lista de nomes riscados"), trinket("Pilão com insígnia misteriosa")]],
  },
  Brawler: {
    id: "Brawler",
    domains: ["Bone", "Valor"],
    source: "expansion",
    suggestedTraits: { agility: 1, strength: 1, finesse: 0, instinct: 2, presence: 0, knowledge: -1 },
    suggestedEquipment: [
      weapon("Bastão", "Instinto · Corpo-a-Corpo · d10+3 físico · duas mãos"),
      armor("Couro", "Limiares 6/13 · Armadura 3"),
      ...commonPack,
    ],
    equipmentChoices: [[trinket("Faixas de mão de um mentor"), trinket("Livro sobre um passatempo secreto")]],
  },
  Warlock: {
    id: "Warlock",
    domains: ["Dread", "Grace"],
    source: "expansion",
    suggestedTraits: { agility: 1, strength: -1, finesse: 0, instinct: 1, presence: 2, knowledge: 0 },
    suggestedEquipment: [
      weapon("Cetro", "Presença · Distante · d6 físico · Versátil"),
      armor("Couro", "Limiares 6/13 · Armadura 3"),
      ...commonPack,
    ],
    equipmentChoices: [[trinket("Escultura que simboliza o patrono"), trinket("Anel que não pode ser removido")]],
  },
  Witch: {
    id: "Witch",
    domains: ["Dread", "Sage"],
    source: "expansion",
    suggestedTraits: { agility: 0, strength: -1, finesse: 0, instinct: 2, presence: 1, knowledge: 1 },
    suggestedEquipment: [
      weapon("Bastão duplo", "Instinto · Distante · d6+3 mágico · duas mãos"),
      armor("Gambesão", "Limiares 5/11 · Armadura 3 · Flexível (+1 Evasão)"),
      ...commonPack,
    ],
    equipmentChoices: [[trinket("Vassoura artesanal"), trinket("Bolsa de ossos de animais")]],
  },
  "Blood Hunter": {
    id: "Blood Hunter",
    domains: ["Blade", "Blood"],
    source: "playtest",
    suggestedTraits: { agility: 2, strength: -1, finesse: 1, instinct: 1, presence: 0, knowledge: 0 },
    suggestedEquipment: [
      weapon("Espada longa", "Agilidade · Corpo-a-Corpo · d10+3 físico · duas mãos"),
      armor("Couro", "Limiares 6/13 · Armadura 3"),
      ...commonPack,
    ],
    equipmentChoices: [[trinket("Agulha de aço"), trinket("Frasco com sangue de um inimigo")]],
  },
};

export const DOMAIN_LEVEL_ONE_CARDS: Record<string, string[]> = {
  Arcana: ["Rune Ward", "Unleash Chaos", "Wall Walk"],
  Blade: ["Get Back Up", "Not Good Enough", "Whirlwind"],
  Blood: ["Blood Spike", "Lifeblood Talisman", "Power Through Pain"],
  Bone: ["Deft Maneuvers", "I See It Coming", "Untouchable"],
  Codex: ["Book of Ava", "Book of Illiat", "Book of Tyfar"],
  Dread: ["Blighting Strike", "Voice of Dread", "Umbral Veil"],
  Grace: ["Deft Deceiver", "Enrapture", "Inspirational Words"],
  Midnight: ["Pick and Pull", "Rain of Blades", "Uncanny Disguise"],
  Sage: ["Gifted Tracker", "Nature’s Tongue", "Vicious Entangle"],
  Splendor: ["Bolt Beacon", "Mending Touch", "Reassurance"],
  Valor: ["Bare Bones", "Forceful Push", "I Am Your Shield"],
};

export function classEntries() {
  return daggerheartCompendium.entries.filter((entry) =>
    entry.type === "class" && Boolean(CLASS_CONFIG[entry.sourceId || ""]),
  );
}

export function subclassesFor(classId: string) {
  return daggerheartCompendium.entries.filter((entry) =>
    entry.type === "subclass" && entry.parent === classId,
  );
}

export function classFeaturesFor(classId: string) {
  return daggerheartCompendium.entries.filter((entry) =>
    entry.type === "classFeature" && entry.parent === classId,
  );
}

export function subclassFeaturesFor(subclassId: string) {
  return daggerheartCompendium.entries.filter((entry) =>
    entry.type === "subclassFeature" && entry.parent === subclassId,
  );
}

export function ancestryEntries() {
  return daggerheartCompendium.entries.filter((entry) => entry.type === "ancestry");
}

export function ancestryFeaturesFor(ancestryId: string) {
  return daggerheartCompendium.entries.filter((entry) =>
    entry.type === "ancestryFeature" && entry.parent === ancestryId,
  );
}

export function communityEntries() {
  return daggerheartCompendium.entries.filter((entry) => entry.type === "community");
}

export function communityFeaturesFor(communityId: string) {
  return daggerheartCompendium.entries.filter((entry) =>
    entry.type === "communityFeature" && entry.parent === communityId,
  );
}

export function levelOneDomainCards(classId: string) {
  const config = CLASS_CONFIG[classId];
  if (!config) return [] as Array<CompendiumEntry & { domain: string }>;
  const cards: Array<CompendiumEntry & { domain: string }> = [];
  for (const domain of config.domains) {
    for (const sourceId of DOMAIN_LEVEL_ONE_CARDS[domain] || []) {
      const card = daggerheartCompendium.entries.find((entry) =>
        entry.type === "domainCard" && entry.sourceId === sourceId,
      );
      if (card) cards.push({ ...card, domain });
    }
  }
  return cards;
}

export function suggestedTraitsFor(classId: string, subclassId?: string) {
  const config = CLASS_CONFIG[classId];
  if (!config) return null;
  if (classId === "Blood Hunter" && subclassId === "Order of the Lycan") {
    return { agility: 1, strength: 2, finesse: -1, instinct: 1, presence: 0, knowledge: 0 } satisfies Record<CharacterTraitName, number>;
  }
  return config.suggestedTraits;
}

export function armorSlotsFromItems(items: Array<{ name: string; detail: string }>) {
  const armor = items.find((item) => /armadura|couro|gambesão|cota de malha/i.test(item.name + " " + item.detail));
  if (!armor) return 0;
  const match = armor.detail.match(/Armadura\s+(\d+)/i);
  return match ? Number(match[1]) : 0;
}
