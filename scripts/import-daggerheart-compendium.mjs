import fs from "node:fs";
import path from "node:path";
import { FOUNDRYBORNE_SOURCE_URL, normalizeSourceArtName } from "./sync-foundryborne-art.mjs";

const root = process.cwd();
const translationRoot = process.env.DAGGERHEART_TRANSLATION
  ? path.resolve(process.env.DAGGERHEART_TRANSLATION)
  : path.resolve(root, "..", "daggerheart-translation-pt-BR");
const artRoot = process.env.DAGGERHEART_ART
  ? path.resolve(process.env.DAGGERHEART_ART)
  : path.resolve(root, "..", "art-for-daggerheart");

const compendiumRoot = path.join(translationRoot, "compendium");
const langPath = path.join(translationRoot, "lang", "pt-BR.json");
const outputPath = path.join(root, "lib", "compendium", "daggerheart.generated.json");
const artOutputRoot = path.join(root, "public", "compendium", "daggerheart", "adversaries");
const foundryborneManifestPath = path.join(root, "lib", "compendium", "foundryborne-art.manifest.json");
const foundryborneSubclassManifestPath = path.join(root, "lib", "compendium", "foundryborne-subclass-features.manifest.json");

const CORE_CLASSES = new Set([
  "Bard", "Druid", "Guardian", "Ranger", "Rogue", "Seraph", "Sorcerer", "Warrior", "Wizard",
]);
const EXPANSION_CLASSES = new Set(["Assassin", "Blood Hunter", "Brawler", "Warlock", "Witch"]);
const CORE_ANCESTRIES = new Set([
  "Dwarf", "Clank", "Drakona", "Elf", "Faerie", "Faun", "Firbolg", "Fungril", "Galapa",
  "Giant", "Goblin", "Human", "Infernis", "Katari", "Orc", "Halfling", "Ribbet", "Simiah",
]);
const EXPANSION_ANCESTRIES = new Set(["Aetheris", "Earthkin", "Emberkin", "Gnome", "Skykin", "Tidekin"]);
const CORE_COMMUNITIES = new Set([
  "Highborne", "Loreborne", "Orderborne", "Ridgeborne", "Seaborne", "Slyborne",
  "Underborne", "Wanderborne", "Wildborne",
]);
const EXPANSION_COMMUNITIES = new Set([
  "Duneborne", "Freeborne", "Frostborne", "Hearthborne", "Reborne", "Warborne",
]);
const EXPANSION_ANCESTRY_FEATURE_PARENT = {
  "Divine Countenance": "Aetheris",
  "Hallowed Aura": "Aetheris",
  Immovable: "Earthkin",
  Stoneskin: "Earthkin",
  Fireproof: "Emberkin",
  Ignition: "Emberkin",
  "Nimble Fingers": "Gnome",
  "True Sight": "Gnome",
  "Eye of the Storm": "Skykin",
  "Gale Force": "Skykin",
  Amphibious: "Tidekin",
  Lifespring: "Tidekin",
};
const COMMUNITY_FEATURE_PARENT = {
  "Know the Tide": "Seaborne",
  "Nomadic Pack": "Wanderborne",
  Dedicated: "Orderborne",
  Privilege: "Highborne",
  Steady: "Ridgeborne",
  "Well-Read": "Loreborne",
  Lightfoot: "Wildborne",
  Scoundrel: "Slyborne",
  "Low-Light Living": "Underborne",
  Oasis: "Duneborne",
  "Found Family": "Freeborne",
  Hardy: "Frostborne",
  "Close-Knit": "Hearthborne",
  Unbound: "Reborne",
  "Brave Face": "Warborne",
};
const CORE_SUBCLASSES = new Set([
  "Troubadour", "Wordsmith",
  "Warden of the Elements", "Warden of Renewal",
  "Stalwart", "Vengeance",
  "Beastbound", "Wayfinder",
  "Nightwalker", "Syndicate",
  "Divine Wielder", "Winged Sentinel",
  "Elementalist", "Primal Origin",
  "Call Of The Brave", "Call Of The Slayer",
  "School Of Knowledge", "School Of War",
]);
const CLASS_FEATURE_PARENT = {
  "Make a Scene": "Bard",
  Rally: "Bard",
  "Rally (Level 5)": "Bard",
  Evolution: "Druid",
  Beastform: "Druid",
  Wildtouch: "Druid",
  "Frontline Tank": "Guardian",
  Unstoppable: "Guardian",
  "Hold Them Off": "Ranger",
  "Ranger's Focus": "Ranger",
  "Rogue's Dodge": "Rogue",
  Cloaked: "Rogue",
  "Sneak Attack": "Rogue",
  "Life Support": "Seraph",
  "Prayer Dice": "Seraph",
  "Volatile Magic": "Sorcerer",
  "Arcane Sense": "Sorcerer",
  "Minor Illusion": "Sorcerer",
  "Channel Raw Power": "Sorcerer",
  "No Mercy": "Warrior",
  "Attack Of Opportunity": "Warrior",
  "Combat Training": "Warrior",
  "Not This Time": "Wizard",
  Prestidigitation: "Wizard",
  "Strange Patterns": "Wizard",
};
const SUBCLASS_CLASS_PARENT = {
  Troubadour: "Bard",
  Wordsmith: "Bard",
  "Warden of the Elements": "Druid",
  "Warden of Renewal": "Druid",
  Stalwart: "Guardian",
  Vengeance: "Guardian",
  Beastbound: "Ranger",
  Wayfinder: "Ranger",
  Nightwalker: "Rogue",
  Syndicate: "Rogue",
  "Divine Wielder": "Seraph",
  "Winged Sentinel": "Seraph",
  Elementalist: "Sorcerer",
  "Primal Origin": "Sorcerer",
  "Call Of The Brave": "Warrior",
  "Call Of The Slayer": "Warrior",
  "School Of Knowledge": "Wizard",
  "School Of War": "Wizard",
};
const EXPANSION_CLASS_FEATURE_PARENT = {
  "Blood Maledict": "Blood Hunter",
  "Grim Psychometry": "Blood Hunter",
  "Crimson Rite": "Blood Hunter",
  "Patron's Boon": "Warlock",
  "Warlock Patron": "Warlock",
  Favor: "Warlock",
};
const EXPANSION_SUBCLASS_PARENT = {
  "Executioners Guild": "Assassin",
  "Poisoners Guild": "Assassin",
  "Order of the Ghost Slayer": "Blood Hunter",
  "Order of the Lycan": "Blood Hunter",
  "Order of the Mutant": "Blood Hunter",
  Juggernaut: "Brawler",
  "Martial Artist": "Brawler",
  "Pact of the Endless": "Warlock",
  "Pact of the Wrathful": "Warlock",
  Hedge: "Witch",
  Moon: "Witch",
};
const EXPANSION_SUBCLASS_FEATURE_PARENT = {
  "Chasing Death": "Order of the Ghost Slayer",
  "Shadowed Grit": "Order of the Ghost Slayer",
  Veilwalker: "Order of the Ghost Slayer",
  "Spectral Form": "Order of the Ghost Slayer",
  Mutagens: "Order of the Mutant",
  "Improved Mutagens": "Order of the Mutant",
  "Volatile Toxins": "Order of the Mutant",
  "Mastered Mutagens": "Order of the Mutant",
  Werewolf: "Order of the Lycan",
  "Control the Beast": "Order of the Lycan",
  "Feral Hide": "Order of the Lycan",
  "Lycan Regeneration": "Order of the Lycan",
  "Master the Beast": "Order of the Lycan",
  "Patron's Mantle": "Pact of the Endless",
  "Deadly Devotion": "Pact of the Endless",
  "Draining Invocation": "Pact of the Endless",
  "Dark Aegis": "Pact of the Endless",
  "Draining Bane": "Pact of the Endless",
  "Favored Weapon": "Pact of the Wrathful",
  "Herald of Death": "Pact of the Wrathful",
  "Menacing Reach": "Pact of the Wrathful",
  "Diminish My Foes": "Pact of the Wrathful",
  "Fearsome Attack": "Pact of the Wrathful",
  "Divine Ire": "Pact of the Wrathful",
};
const EXPANSION_CLASS_DESCRIPTION_FALLBACK = {
  Warlock: "Ocultistas obtêm poder por meio de um pacto com uma entidade sobrenatural. Sua magia depende da relação que mantêm com esse patrono, pedindo favores, oferecendo tributos e recorrendo às esferas de influência da entidade para superar desafios. Esse poder pode ser extraordinário, mas sempre carrega o peso de uma dívida e de uma vontade externa.",
};
const EXPANSION_SUBCLASS_DESCRIPTION_FALLBACK = {
  "Executioners Guild": "Execute seus alvos com precisão letal e golpes decisivos.",
  "Poisoners Guild": "Debilite seus alvos usando venenos e aflições.",
  "Order of the Ghost Slayer": "Cace os mortos e caminhe perigosamente próximo ao véu entre a vida e a morte.",
  "Order of the Lycan": "Assuma uma forma lupina e transforme sua ferocidade em poder.",
  "Order of the Mutant": "Altere seu corpo com mutagênicos para adaptar suas capacidades à situação.",
  Juggernaut: "Esmague seus oponentes com força e resistência implacáveis.",
  "Martial Artist": "Use técnicas e posturas marciais variadas para dominar o combate desarmado.",
  "Pact of the Endless": "Resista aos inimigos e evite a morte com a proteção de seu patrono.",
  "Pact of the Wrathful": "Canalize a fúria de seu patrono para destruir aqueles que se opõem a você.",
  Hedge: "Use sua arte e seus rituais para fortalecer a si mesmo e seus aliados.",
  Moon: "Canalize poder celestial para ampliar e transformar sua magia.",
};
const EXPANSION_FALLBACK_CLASS_FEATURES = [
  {
    key: "Deadly Determination",
    parent: "Assassin",
    name: "Determinação Mortal",
    description: "Gaste 3 Pontos de Esperança para limpar 2 Pontos de Fadiga.",
  },
  {
    key: "Marked for Death",
    parent: "Assassin",
    name: "Marcado para Morrer",
    description: "Ao acertar um ataque com arma, você pode marcar 1 Ponto de Fadiga para deixar o alvo Marcado para Morrer. Quando causar dano a esse alvo, some à rolagem de dano uma quantidade de d4 igual ao seu Patamar. Você só pode manter um adversário Marcado para Morrer por vez. A marca termina quando você descansa, quando o alvo é derrotado ou quando o Mestre gasta uma quantidade de Pontos de Medo igual ao seu Patamar para removê-la.",
  },
  {
    key: "Get In & Get Out",
    parent: "Assassin",
    name: "Entrar e Sair",
    description: "Gaste 1 Ponto de Esperança para perguntar ao Mestre por uma maneira rápida ou discreta de entrar ou sair de um lugar que você possa ver. O próximo teste que fizer agindo com base nessa informação tem vantagem.",
  },
  {
    key: "Square Up",
    parent: "Brawler",
    name: "Partir pra Cima",
    description: "Gaste 3 Pontos de Esperança para intimidar um alvo em alcance Próximo, deixando-o temporariamente Vulnerável.",
  },
  {
    key: "I Am the Weapon",
    parent: "Brawler",
    name: "Eu Sou a Arma",
    description: "Seus ataques desarmados são tão perigosos quanto qualquer lâmina. Enquanto não tiver outra arma ativa, você possui uma arma principal chamada Golpe de Pugilista. Escolha um atributo para usá-la; ela tem alcance Corpo-a-Corpo e causa d8+d6 de dano físico usando sua Proficiência, com ambos os dados escalando pela Proficiência. Enquanto essa arma estiver ativa, sua Evasão recebe +1.",
  },
  {
    key: "Combo Strike",
    parent: "Brawler",
    name: "Golpe Combinado",
    description: "Depois de rolar o dano de um ataque corpo a corpo bem-sucedido, você pode marcar 1 Ponto de Fadiga para iniciar um combo. Role seu Dado de Combo e anote o resultado, continuando a rolá-lo até que o resultado mais recente seja menor que o anterior. Cause dano adicional igual à soma de todos os resultados do Dado de Combo. Esse dado começa como d4 e pode aumentar em um passo uma vez por Patamar como opção de avanço.",
  },
  {
    key: "Witch's Charm",
    parent: "Witch",
    name: "Encanto do Bruxo",
    description: "Quando você ou um aliado em alcance Distante falhar em um teste de ação, gaste 3 Pontos de Esperança para transformar o resultado em um sucesso com Medo.",
  },
  {
    key: "Hex",
    parent: "Witch",
    name: "Maldição",
    description: "Marque 1 Ponto de Fadiga para amaldiçoar temporariamente um alvo em alcance Distante. Enquanto estiver Amaldiçoado, o alvo sofre uma penalidade nas rolagens de dano e na Dificuldade igual ao seu Patamar. Você pode manter uma quantidade de criaturas Amaldiçoadas igual ao seu atributo de conjuração.",
  },
  {
    key: "Commune",
    parent: "Witch",
    name: "Comunhão",
    description: "Uma vez por descanso longo, durante um momento de calma, você pode comungar com um ancestral, divindade, espírito ou entidade de outro mundo. Faça uma pergunta e role uma quantidade de d6 igual ao seu atributo de conjuração. Escolha um resultado: com 1–3, você recebe uma sensação relevante; com 4–5, ouve sons ou vê uma visão; com 6, vivencia psiquicamente uma cena relacionada à resposta.",
  },
];
const CLASS_ITEMS = new Set([
  "Broken Compass", "Whispering Orb", "A Romance Novel", "Grappling Hook", "Drawing Of A Lover",
  "A Sharpening Stone", "Strange Dirty Penant", "Tiny Elemental Pet", "Secret Key",
  "Letter(Never Opened)", "Family Heirloom", "Bundle of Offerings", "Totem from Mentor",
  "Trophy from your First Kill", "Untranslated Book", "50ft of Rope", "Sigil of Your God",
  "Small Bag (Rocks & Bones)", "Basic Supplies", "Set of Forgery Tools", "Torch",
  "Steel Needle", "Vial of Blood", "Carving", "Ring",
]);

const RANGE_TERMS = [
  "Pessoal", "Corpo-a-Corpo", "Adjacente", "Muito Próximo", "Muito Perto", "Próximo", "Perto",
  "Distante", "Longe", "Muito Distante", "Muito Longe",
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function cleanText(value = "") {
  return decodeEntities(String(value))
    .replace(/\[\[\/r\s+([^\]]+)\]\]/gi, "$1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function slug(value) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const CLASS_FEATURE_ART_ROOT = "/compendium/daggerheart/class-features";
const CLASS_FEATURE_ART_SLUGS = new Set([
  "alicerce-da-vida", "ataque-de-oportunidade", "ataque-furtivo", "bencao-do-patrono",
  "canalizar-poder-bruto", "comunhao", "dadiva-da-natureza", "dados-de-oracao",
  "determinacao", "determinacao-moral", "encanto-do-bruxo", "entrar-e-sair", "esquiva-de-ladino",
  "eu-sou-a-arma", "evolucao", "favor", "fazer-uma-cena", "forma-de-fera",
  "golpe-combinado", "ilusao-menor", "inspiracao", "linha-de-frente", "magia-volatil",
  "maldicao", "maldicao-de-sangue", "marca-da-presa", "marcado-para-morrer",
  "nao-dessa-vez", "oculto", "padroes-estranhos", "partir-pra-cima", "patrono-oculto",
  "prestidigitacao", "psicometria-sombria", "ritual-carmesin", "segurem-eles",
  "sem-piedade", "sentido-arcano", "treinamento-de-combate",
]);
const CLASS_FEATURE_ART_ALIASES = new Map([
  ["inspiracao-nivel-5", "inspiracao"],
  ["determinacao-mortal", "determinacao-moral"],
  ["ritual-carmessim", "ritual-carmesin"],
]);

function classFeatureArtFor(data, key) {
  const displaySlug = slug(cleanText(data.name || key));
  const artSlug = CLASS_FEATURE_ART_ALIASES.get(displaySlug) || displaySlug;
  return CLASS_FEATURE_ART_SLUGS.has(artSlug) ? `${CLASS_FEATURE_ART_ROOT}/${artSlug}.webp` : null;
}

function wordNumber(value) {
  const normalized = value && value.toLocaleLowerCase("pt-BR");
  if (!normalized) return null;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return ({ um: 1, uma: 1, dois: 2, duas: 2, três: 3, quatro: 4, cinco: 5 })[normalized] ?? null;
}

function extractMechanics(description) {
  const costs = [];
  const seenCosts = new Set();
  const costRegex = /\b(?:gaste|gastar|gastando|marque|marcar|marcando)\s+(?:até\s+)?(\d+|um|uma|dois|duas|três|qualquer quantidade)?\s*(?:Pontos?\s+de\s+|Ponto\s+de\s+|de\s+)?(Esperança|Fadiga|Armadura|Vida|Medo)\b/giu;
  for (const match of description.matchAll(costRegex)) {
    const resource = match[2] === "Vida" ? "Ponto de Vida" : match[2];
    const amount = wordNumber(match[1]);
    const labelAmount = amount || match[1] || "variável";
    const key = resource + ":" + labelAmount;
    if (seenCosts.has(key)) continue;
    seenCosts.add(key);
    costs.push({ resource, amount, label: labelAmount + " " + resource });
  }

  const damage = [];
  const seenDamage = new Set();
  const damageRegex = /\b(\d*d\d+(?:(?:\s*[+-]\s*)(?:\d*d\d+|\d+))*)\s+(?:de\s+)?dano(?:\s+(físico|mágico))?/giu;
  for (const match of description.matchAll(damageRegex)) {
    const formula = match[1].replace(/\s+/g, "");
    const type = match[2] ? match[2].toLocaleLowerCase("pt-BR") : undefined;
    const key = formula + ":" + (type || "");
    if (!seenDamage.has(key)) {
      seenDamage.add(key);
      damage.push({ formula, type });
    }
  }

  const tests = [];
  const seenTests = new Set();
  const testRegex = /\bteste de (Conjuração|Reação|Agilidade|Força|Acuidade|Instinto|Presença|Conhecimento)\b/giu;
  for (const match of description.matchAll(testRegex)) {
    const label = "Teste de " + match[1];
    const normalized = label.toLocaleLowerCase("pt-BR");
    if (!seenTests.has(normalized)) {
      seenTests.add(normalized);
      tests.push(label);
    }
  }

  const difficulties = [];
  for (const match of description.matchAll(/\b(?:Dificuldade|teste(?: de [\p{L}]+)?)\s*\((\d{1,2})\)/giu)) {
    const value = Number(match[1]);
    if (!difficulties.includes(value)) difficulties.push(value);
  }

  const lowerDescription = description.toLocaleLowerCase("pt-BR");
  const ranges = RANGE_TERMS
    .slice()
    .sort((a, b) => b.length - a.length)
    .filter((term, index, terms) => {
      const normalized = term.toLocaleLowerCase("pt-BR");
      if (!lowerDescription.includes(normalized)) return false;
      return !terms.slice(0, index).some((longer) => {
        const longerNormalized = longer.toLocaleLowerCase("pt-BR");
        return longerNormalized.includes(normalized) && lowerDescription.includes(longerNormalized);
      });
    });
  const frequencyMatches = description.match(/\b(?:uma vez por (?:sessão|descanso(?: longo| curto)?)|no início de cada sessão|após um descanso longo|por sessão)\b/giu) || [];
  const frequency = [...new Set(frequencyMatches.map((value) => value.replace(/^./, (c) => c.toUpperCase())))];
  const reaction = /\bteste de reação\b/iu.test(description);

  return {
    costs,
    damage,
    tests,
    difficulties,
    ranges,
    frequency,
    reaction,
    hope: /\bEsperança\b/iu.test(description),
    fear: /\bMedo\b/iu.test(description),
  };
}

function makeEntry({ key, data, type, category, source = "core", parent = null, tier = null, art = null, artSource = null, artLicense = null }) {
  const description = cleanText(data.description || "");
  const entry = {
    id: source + "-" + type + "-" + slug(key),
    sourceId: key,
    name: cleanText(data.name || key),
    originalName: key,
    type,
    category,
    source,
    parent,
    description,
    mechanics: extractMechanics(description),
    art,
  };
  if (tier) entry.tier = tier;
  if (artSource) entry.artSource = artSource;
  if (artLicense) entry.artLicense = artLicense;
  return entry;
}

function loadEntries(file) {
  const data = readJson(path.join(compendiumRoot, file));
  return Object.entries(data.entries || {});
}

const foundryborneManifest = fs.existsSync(foundryborneManifestPath)
  ? readJson(foundryborneManifestPath)
  : { entries: [] };
const foundryborneDomainArt = new Map();
for (const entry of foundryborneManifest.entries || []) {
  if (entry.type !== "domainCard") continue;
  const normalizedName = normalizeSourceArtName(entry.name);
  if (!normalizedName || entry.normalizedName !== normalizedName) {
    throw new Error(`Invalid Foundryborne art manifest entry: ${entry.name || "<unnamed>"}`);
  }
  foundryborneDomainArt.set(normalizedName, entry);
}

function domainArtFor(key) {
  return foundryborneDomainArt.get(normalizeSourceArtName(key)) || null;
}

if (!fs.existsSync(foundryborneSubclassManifestPath)) {
  throw new Error(`Missing subclass metadata manifest: ${foundryborneSubclassManifestPath}. Run npm run sync:foundryborne-subclasses.`);
}
const foundryborneSubclassManifest = readJson(foundryborneSubclassManifestPath);
const subclassFeatureMetadata = new Map();
for (const entry of foundryborneSubclassManifest.entries || []) {
  if (entry.type !== "subclassFeature") continue;
  if (!entry.normalizedName || entry.normalizedName !== normalizeSourceArtName(entry.name)) {
    throw new Error(`Invalid Foundryborne subclass manifest feature: ${entry.name || "<unnamed>"}`);
  }
  if (!entry.normalizedParent || entry.normalizedParent !== normalizeSourceArtName(entry.parent)) {
    throw new Error(`Invalid Foundryborne subclass manifest parent: ${entry.parent || "<unnamed>"}`);
  }
  if (!["foundation", "specialization", "mastery"].includes(entry.tier)) {
    throw new Error(`Invalid Foundryborne subclass tier for ${entry.name}: ${entry.tier || "<missing>"}`);
  }
  const list = subclassFeatureMetadata.get(entry.normalizedName) || [];
  list.push(entry);
  subclassFeatureMetadata.set(entry.normalizedName, list);
}

const subclassFeatureAliases = new Map([
  [normalizeSourceArtName("Elemental Origin"), normalizeSourceArtName("Elementalist")],
]);
const coreSubclassByNormalizedName = new Map(
  [...CORE_SUBCLASSES].map((name) => [normalizeSourceArtName(name), name]),
);
const expansionSubclassByNormalizedName = new Map(
  Object.keys(EXPANSION_SUBCLASS_PARENT).map((name) => [normalizeSourceArtName(name), name]),
);
const subclassParentAliases = new Map([
  [normalizeSourceArtName("Elemental Origin"), "Elementalist"],
]);
const legacyExpansionSubclassTiers = new Map(Object.entries({
  // Blood Hunter · The Void v1.5
  "Chasing Death": "foundation",
  "Shadowed Grit": "foundation",
  Veilwalker: "specialization",
  "Spectral Form": "mastery",
  Mutagens: "foundation",
  "Improved Mutagens": "specialization",
  "Volatile Toxins": "specialization",
  "Mastered Mutagens": "mastery",
  Werewolf: "foundation",
  "Control the Beast": "foundation",
  "Feral Hide": "specialization",
  "Lycan Regeneration": "specialization",
  "Master the Beast": "mastery",
  // Warlock · The Void v1.5 names retained by the PT-BR translation.
  "Deadly Devotion": "foundation",
  "Draining Invocation": "specialization",
  "Favored Weapon": "foundation",
  "Herald of Death": "foundation",
  "Divine Ire": "mastery",
}).map(([name, tier]) => [normalizeSourceArtName(name), tier]));

function localSubclassSourceId(parent) {
  const normalized = normalizeSourceArtName(parent);
  return subclassParentAliases.get(normalized)
    || coreSubclassByNormalizedName.get(normalized)
    || expansionSubclassByNormalizedName.get(normalized)
    || parent;
}

function subclassFeatureMetaFor(key, expectedParent = null) {
  const rawNormalized = normalizeSourceArtName(key);
  const normalized = subclassFeatureAliases.get(rawNormalized) || rawNormalized;
  const candidates = subclassFeatureMetadata.get(normalized) || [];
  if (!expectedParent) return candidates.length === 1 ? candidates[0] : null;
  const expected = normalizeSourceArtName(expectedParent);
  return candidates.find((entry) => entry.normalizedParent === expected) || null;
}

const entries = [];

let currentCoreAncestry = null;
for (const [key, data] of loadEntries("daggerheart.ancestries.json")) {
  const isAncestry = CORE_ANCESTRIES.has(key);
  if (isAncestry) currentCoreAncestry = key;
  entries.push(makeEntry({
    key,
    data,
    type: isAncestry ? "ancestry" : "ancestryFeature",
    category: "ancestries",
    parent: isAncestry ? null : currentCoreAncestry,
  }));
}
for (const [key, data] of loadEntries("daggerheart-expansion-content.ancestries.json")) {
  const isAncestry = EXPANSION_ANCESTRIES.has(key);
  entries.push(makeEntry({
    key,
    data,
    type: isAncestry ? "ancestry" : "ancestryFeature",
    category: "ancestries",
    source: "expansion",
    parent: isAncestry ? null : EXPANSION_ANCESTRY_FEATURE_PARENT[key] || null,
  }));
}
for (const [key, data] of loadEntries("daggerheart.communities.json")) {
  const isCommunity = CORE_COMMUNITIES.has(key);
  entries.push(makeEntry({
    key,
    data,
    type: isCommunity ? "community" : "communityFeature",
    category: "communities",
    parent: isCommunity ? null : COMMUNITY_FEATURE_PARENT[key] || null,
  }));
}
for (const [key, data] of loadEntries("daggerheart-expansion-content.communities.json")) {
  const isCommunity = EXPANSION_COMMUNITIES.has(key);
  entries.push(makeEntry({
    key,
    data,
    type: isCommunity ? "community" : "communityFeature",
    category: "communities",
    source: "expansion",
    parent: isCommunity ? null : COMMUNITY_FEATURE_PARENT[key] || null,
  }));
}
for (const [key, data] of loadEntries("daggerheart.classes.json")) {
  if (!CLASS_ITEMS.has(key)) {
    const isClass = CORE_CLASSES.has(key);
    entries.push(makeEntry({
      key,
      data,
      type: isClass ? "class" : "classFeature",
      category: "classes",
      parent: isClass ? null : CLASS_FEATURE_PARENT[key] || null,
      art: isClass ? null : classFeatureArtFor(data, key),
    }));
  }
}
const expansionClassSourceEntries = loadEntries("daggerheart-expansion-content.classes.json");
const expansionClassSourceKeys = new Set(expansionClassSourceEntries.map(([key]) => key));
for (const [key, rawData] of expansionClassSourceEntries) {
  if (!key.trim() || CLASS_ITEMS.has(key)) continue;
  const isClass = EXPANSION_CLASSES.has(key);
  const subclassParent = EXPANSION_SUBCLASS_FEATURE_PARENT[key];
  const subclassMeta = subclassParent ? subclassFeatureMetaFor(key, subclassParent) : null;
  const legacySubclassTier = subclassParent
    ? legacyExpansionSubclassTiers.get(normalizeSourceArtName(key)) || null
    : null;
  const data = {
    ...rawData,
    description: rawData.description || EXPANSION_CLASS_DESCRIPTION_FALLBACK[key] || "",
  };
  entries.push(makeEntry({
    key,
    data,
    type: isClass ? "class" : subclassParent ? "subclassFeature" : "classFeature",
    category: subclassParent ? "subclasses" : "classes",
    source: "expansion",
    parent: isClass ? null : subclassParent || EXPANSION_CLASS_FEATURE_PARENT[key] || null,
    tier: subclassMeta?.tier || legacySubclassTier,
    art: !isClass && !subclassParent ? classFeatureArtFor(data, key) : null,
  }));
}
for (const fallback of EXPANSION_FALLBACK_CLASS_FEATURES) {
  if (expansionClassSourceKeys.has(fallback.key)) continue;
  entries.push(makeEntry({
    key: fallback.key,
    data: { name: fallback.name, description: fallback.description },
    type: "classFeature",
    category: "classes",
    source: "srd2",
    parent: fallback.parent,
    art: classFeatureArtFor(fallback, fallback.key),
  }));
}
for (const [key, data] of loadEntries("daggerheart.subclasses.json")) {
  const isSubclass = CORE_SUBCLASSES.has(key);
  const subclassMeta = isSubclass ? null : subclassFeatureMetaFor(key);
  if (!isSubclass && !subclassMeta) throw new Error(`Missing subclass metadata for core feature ${key}.`);
  const subclassParent = subclassMeta ? localSubclassSourceId(subclassMeta.parent) : null;
  if (subclassParent && !CORE_SUBCLASSES.has(subclassParent)) {
    throw new Error(`Core subclass feature ${key} resolved to unknown parent ${subclassParent}.`);
  }
  entries.push(makeEntry({
    key,
    data,
    type: isSubclass ? "subclass" : "subclassFeature",
    category: "subclasses",
    parent: isSubclass ? SUBCLASS_CLASS_PARENT[key] || null : subclassParent,
    tier: subclassMeta?.tier || null,
  }));
}
for (const [key, rawData] of loadEntries("daggerheart-expansion-content.subclasses.json")) {
  if (!key.trim()) continue;
  const data = {
    ...rawData,
    description: rawData.description || EXPANSION_SUBCLASS_DESCRIPTION_FALLBACK[key] || "",
  };
  entries.push(makeEntry({
    key,
    data,
    type: "subclass",
    category: "subclasses",
    source: "expansion",
    parent: EXPANSION_SUBCLASS_PARENT[key] || null,
  }));
}
for (const [key, data] of loadEntries("daggerheart.domains.json")) {
  const sourceArt = domainArtFor(key);
  entries.push(makeEntry({
    key,
    data,
    type: "domainCard",
    category: "domains",
    art: sourceArt?.art || null,
    artSource: sourceArt?.artSource || null,
    artLicense: sourceArt?.artLicense || null,
  }));
}
for (const [key, data] of loadEntries("daggerheart-expansion-content.domains.json")) {
  if (key.trim()) {
    const sourceArt = domainArtFor(key);
    entries.push(makeEntry({
      key,
      data,
      type: "domainCard",
      category: "domains",
      source: "expansion",
      art: sourceArt?.art || null,
      artSource: sourceArt?.artSource || null,
      artLicense: sourceArt?.artLicense || null,
    }));
  }
}

for (const [file, type] of [
  ["daggerheart.weapons.json", "weapon"],
  ["daggerheart.armors.json", "armor"],
  ["daggerheart.consumables.json", "consumable"],
  ["daggerheart.loot.json", "loot"],
]) {
  for (const [key, data] of loadEntries(file)) {
    entries.push(makeEntry({ key, data, type, category: "equipment" }));
  }
}

const portraitDir = path.join(artRoot, "adversaries", "portraits");
const portraitFiles = fs.existsSync(portraitDir) ? fs.readdirSync(portraitDir).filter((file) => file.toLowerCase().endsWith(".webp")) : [];
const portraitMap = new Map(portraitFiles.map((file) => [
  path.parse(file).name.toLocaleLowerCase("en").replace(/:/g, "").replace(/\s+/g, " ").trim(),
  file,
]));

for (const [key, data] of loadEntries("daggerheart.adversaries.json")) {
  const normalizedKey = key.toLocaleLowerCase("en").replace(/:/g, "").replace(/\s+/g, " ").trim();
  const file = portraitMap.get(normalizedKey);
  const item = makeEntry({
    key,
    data,
    type: "adversary",
    category: "adversaries",
    art: file ? "/compendium/daggerheart/adversaries/" + encodeURIComponent(file) : null,
  });
  item.motivesAndTactics = cleanText(data.motivesAndTactics || "");
  entries.push(item);
}

const lang = readJson(langPath);
const config = (lang.DAGGERHEART && lang.DAGGERHEART.CONFIG) || {};
const emptyMechanics = () => ({
  costs: [],
  damage: [],
  tests: [],
  difficulties: [],
  ranges: [],
  frequency: [],
  reaction: false,
  hope: false,
  fear: false,
});

const rules = [
  {
    id: "rule-action-rolls",
    name: "Testes de Ação e Dados de Dualidade",
    category: "rules",
    type: "rule",
    source: "srd",
    description: "Quando uma ação arriscada ou incerta exige um teste, role dois d12 distintos: o Dado de Esperança e o Dado de Medo. Some os resultados e os modificadores aplicáveis e compare o total à Dificuldade. Se o total igualar ou superar a Dificuldade, a ação tem sucesso; caso contrário, falha. O dado mais alto determina se o resultado vem com Esperança ou com Medo.",
    mechanics: { ...emptyMechanics(), tests: ["Teste de Ação"], hope: true, fear: true },
  },
  {
    id: "rule-roll-results",
    name: "Esperança, Medo e Sucesso Crítico",
    category: "rules",
    type: "rule",
    source: "srd",
    description: "Em um resultado com Esperança, o jogador recebe 1 Esperança. Em um resultado com Medo, o Mestre recebe 1 Medo e pode introduzir custo ou complicação conforme o resultado. Se os dois Dados de Dualidade mostrarem o mesmo valor, é um Sucesso Crítico: a ação tem sucesso automaticamente, o personagem recebe 1 Esperança e limpa 1 Fadiga. Em ataques, um crítico também causa dano crítico.",
    mechanics: { ...emptyMechanics(), hope: true, fear: true },
  },
  {
    id: "rule-reaction-rolls",
    name: "Testes de Reação",
    category: "rules",
    type: "rule",
    source: "srd",
    description: "Testes de Reação funcionam de forma semelhante aos testes de ação, mas não geram Esperança, Medo nem movimentos adicionais do Mestre. Eles são usados quando o personagem reage a um perigo ou efeito que especifica esse tipo de teste.",
    mechanics: { ...emptyMechanics(), tests: ["Teste de Reação"], reaction: true },
  },
  {
    id: "rule-damage",
    name: "Dano e Limiares",
    category: "rules",
    type: "rule",
    source: "srd",
    description: "Depois de acertar um ataque, role os dados de dano da arma em quantidade igual à sua Proficiência e some os modificadores aplicáveis. Compare o total aos limiares de dano do alvo para determinar quantos Pontos de Vida são marcados. Em um ataque com Sucesso Crítico, some primeiro o valor máximo possível dos dados de dano da arma e depois faça a rolagem normal.",
    mechanics: { ...emptyMechanics(), tests: ["Teste de Ataque"] },
  },
  {
    id: "rule-armor",
    name: "Armadura",
    category: "rules",
    type: "rule",
    source: "srd",
    description: "Sua Pontuação de Armadura indica quantos Espaços de Armadura estão disponíveis. Ao sofrer dano, você pode marcar 1 Espaço de Armadura para reduzir a gravidade do dano em um limiar. Apenas 1 Espaço de Armadura pode ser marcado por ataque recebido, salvo quando uma regra disser o contrário.",
    mechanics: { ...emptyMechanics(), costs: [{ resource: "Armadura", amount: 1, label: "1 Armadura" }] },
  },
  {
    id: "rule-stress",
    name: "Fadiga",
    category: "rules",
    type: "rule",
    source: "srd",
    description: "Fadiga representa pressão física, emocional ou mágica. Características e consequências podem mandar marcar Fadiga; descansos e habilidades podem limpá-la. O número de espaços disponíveis é definido pela ficha e por características do personagem.",
    mechanics: emptyMechanics(),
  },
];

for (const [key, value] of Object.entries(config.Traits || {})) {
  rules.push({
    id: "rule-trait-" + key,
    name: value.name,
    category: "rules",
    type: "trait",
    source: "translation",
    description: Object.values(value.verb || {}).join(" · "),
    mechanics: { ...emptyMechanics(), tests: ["Teste de " + value.name] },
  });
}
for (const [key, value] of Object.entries(config.Range || {})) {
  rules.push({
    id: "rule-range-" + key,
    name: "Alcance: " + value.name,
    category: "rules",
    type: "range",
    source: "translation",
    description: cleanText(value.description),
    mechanics: { ...emptyMechanics(), ranges: [value.name] },
  });
}
for (const [key, value] of Object.entries(config.Condition || {})) {
  if (["dead", "defeated"].includes(key)) continue;
  rules.push({
    id: "rule-condition-" + key,
    name: "Condição: " + value.name,
    category: "rules",
    type: "condition",
    source: "translation",
    description: cleanText(value.description),
    mechanics: emptyMechanics(),
  });
}
for (const [key, value] of Object.entries(config.DeathMoves || {})) {
  const description = cleanText(value.description);
  rules.push({
    id: "rule-death-" + key,
    name: "Morte: " + value.name,
    category: "rules",
    type: "deathMove",
    source: "translation",
    description,
    mechanics: extractMechanics(description),
  });
}

entries.unshift(...rules);

const categories = [
  { id: "rules", name: "Regras", icon: "◇", description: "Mecânicas essenciais e referência rápida" },
  { id: "classes", name: "Classes", icon: "✦", description: "Classes e características de classe" },
  { id: "ancestries", name: "Ancestralidades", icon: "◐", description: "Ancestralidades e características" },
  { id: "communities", name: "Comunidades", icon: "⌂", description: "Origens culturais e características" },
  { id: "subclasses", name: "Subclasses", icon: "△", description: "Caminhos e características de subclasse" },
  { id: "domains", name: "Domínios", icon: "◈", description: "Cartas, feitiços e habilidades de domínio" },
  { id: "equipment", name: "Equipamentos", icon: "⚔", description: "Armas, armaduras, consumíveis e itens de saque" },
  { id: "adversaries", name: "Adversários", icon: "♜", description: "Criaturas e oponentes para o Mestre" },
];

const payload = {
  generatedAt: new Date().toISOString(),
  sources: {
    translation: "https://github.com/etiagoabreu/daggerheart-translation-pt-BR",
    art: "https://github.com/mordachai/art-for-daggerheart",
    foundryborne: FOUNDRYBORNE_SOURCE_URL,
    srd: "https://www.daggerheart.com/srd/",
  },
  categories,
  entries,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

if (fs.existsSync(portraitDir)) {
  fs.mkdirSync(artOutputRoot, { recursive: true });
  for (const file of portraitFiles) {
    fs.copyFileSync(path.join(portraitDir, file), path.join(artOutputRoot, file));
  }
}

const counts = Object.fromEntries(categories.map((category) => [
  category.id,
  entries.filter((item) => item.category === category.id).length,
]));
console.log(JSON.stringify({ outputPath, artOutputRoot, entries: entries.length, counts }, null, 2));
