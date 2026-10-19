import fs from "node:fs";
import path from "node:path";

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
const CLASS_ITEMS = new Set([
  "Broken Compass", "Whispering Orb", "A Romance Novel", "Grappling Hook", "Drawing Of A Lover",
  "A Sharpening Stone", "Strange Dirty Penant", "Tiny Elemental Pet", "Secret Key",
  "Letter(Never Opened)", "Family Heirloom", "Bundle of Offerings", "Totem from Mentor",
  "Trophy from your First Kill", "Untranslated Book", "50ft of Rope", "Sigil of Your God",
  "Small Bag (Rocks & Bones)", "Basic Supplies", "Set of Forgery Tools", "Torch",
  "Steel Needle", "Vial of Blood", "Patron's Boon", "Warlock Patron", "Favor", "Carving", "Ring",
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

function wordNumber(value) {
  const normalized = value && value.toLocaleLowerCase("pt-BR");
  if (!normalized) return null;
  if (/^\d+$/.test(normalized)) return Number(normalized);
  return ({ um: 1, uma: 1, dois: 2, duas: 2, três: 3, quatro: 4, cinco: 5 })[normalized] ?? null;
}

function extractMechanics(description) {
  const costs = [];
  const seenCosts = new Set();
  const costRegex = /\b(?:gaste|gastar|gastando|marque|marcar|marcando)\s+(?:até\s+)?(\d+|um|uma|dois|duas|três|qualquer quantidade)?\s*(?:Pontos?\s+de\s+|Ponto\s+de\s+)?(Esperança|Fadiga|Armadura|Vida|Medo)\b/giu;
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
  const damageRegex = /\b(\d*d\d+(?:\s*[+-]\s*\d+)?|d\d+(?:\s*[+-]\s*\d+)?)\s+(?:de\s+)?dano(?:\s+(físico|mágico))?/giu;
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

function makeEntry({ key, data, type, category, source = "core", parent = null, art = null }) {
  const description = cleanText(data.description || "");
  return {
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
}

function loadEntries(file) {
  const data = readJson(path.join(compendiumRoot, file));
  return Object.entries(data.entries || {});
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
    }));
  }
}
for (const [key, data] of loadEntries("daggerheart-expansion-content.classes.json")) {
  if (key.trim() && !CLASS_ITEMS.has(key)) entries.push(makeEntry({ key, data, type: EXPANSION_CLASSES.has(key) ? "class" : "classFeature", category: "classes", source: "expansion" }));
}
for (const [key, data] of loadEntries("daggerheart.subclasses.json")) {
  const isSubclass = CORE_SUBCLASSES.has(key);
  entries.push(makeEntry({
    key,
    data,
    type: isSubclass ? "subclass" : "subclassFeature",
    category: "subclasses",
    parent: isSubclass ? SUBCLASS_CLASS_PARENT[key] || null : null,
  }));
}
for (const [key, data] of loadEntries("daggerheart-expansion-content.subclasses.json")) {
  if (key.trim()) entries.push(makeEntry({ key, data, type: "subclass", category: "subclasses", source: "expansion" }));
}
for (const [key, data] of loadEntries("daggerheart.domains.json")) {
  entries.push(makeEntry({ key, data, type: "domainCard", category: "domains" }));
}
for (const [key, data] of loadEntries("daggerheart-expansion-content.domains.json")) {
  if (key.trim()) entries.push(makeEntry({ key, data, type: "domainCard", category: "domains", source: "expansion" }));
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
  { id: "adversaries", name: "Adversários", icon: "♜", description: "Criaturas e oponentes para o Mestre" },
];

const payload = {
  generatedAt: new Date().toISOString(),
  sources: {
    translation: "https://github.com/etiagoabreu/daggerheart-translation-pt-BR",
    art: "https://github.com/mordachai/art-for-daggerheart",
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
