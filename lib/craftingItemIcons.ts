export const CRAFTING_ITEM_ICON_IDS = [
  "sword", "shield", "armor", "helmet", "bow", "axe", "hammer", "tool",
  "potion", "poison", "vial", "herb", "mushroom", "ore", "metal", "gem",
  "crystal", "ring", "necklace", "scroll", "book", "bone", "fang", "tooth",
  "claw", "paw", "tail", "wing", "horn", "scale", "feather", "hide", "meat",
  "fish", "coin", "material",
] as const;

export type CraftingItemIconId = (typeof CRAFTING_ITEM_ICON_IDS)[number];

export type CraftingItemIcon = {
  id: CraftingItemIconId;
  path: string;
  label: string;
};

const icon = (id: CraftingItemIconId, label: string): CraftingItemIcon => ({
  id,
  path: `/crafting-item-icons/${id}.svg`,
  label,
});

export const CRAFTING_ITEM_ICONS: Record<CraftingItemIconId, CraftingItemIcon> = {
  sword: icon("sword", "Espada"),
  shield: icon("shield", "Escudo"),
  armor: icon("armor", "Armadura"),
  helmet: icon("helmet", "Elmo"),
  bow: icon("bow", "Arco"),
  axe: icon("axe", "Machado"),
  hammer: icon("hammer", "Martelo"),
  tool: icon("tool", "Ferramenta"),
  potion: icon("potion", "Poção"),
  poison: icon("poison", "Veneno"),
  vial: icon("vial", "Frasco/Reagente"),
  herb: icon("herb", "Erva"),
  mushroom: icon("mushroom", "Cogumelo"),
  ore: icon("ore", "Minério"),
  metal: icon("metal", "Metal"),
  gem: icon("gem", "Gema"),
  crystal: icon("crystal", "Cristal"),
  ring: icon("ring", "Anel"),
  necklace: icon("necklace", "Colar/Joia"),
  scroll: icon("scroll", "Pergaminho"),
  book: icon("book", "Livro"),
  bone: icon("bone", "Osso"),
  fang: icon("fang", "Presa"),
  tooth: icon("tooth", "Dente"),
  claw: icon("claw", "Garra"),
  paw: icon("paw", "Pata"),
  tail: icon("tail", "Cauda"),
  wing: icon("wing", "Asa"),
  horn: icon("horn", "Chifre"),
  scale: icon("scale", "Escama"),
  feather: icon("feather", "Pena"),
  hide: icon("hide", "Couro/Pele"),
  meat: icon("meat", "Carne"),
  fish: icon("fish", "Peixe"),
  coin: icon("coin", "Moeda"),
  material: icon("material", "Material"),
};

type MatchRule = readonly [CraftingItemIconId, readonly string[]];

const MATCH_RULES: readonly MatchRule[] = [
  ["sword", ["espada", "espadachim", "sword", "longsword", "shortsword", "blade"]],
  ["shield", ["escudo", "shield", "buckler"]],
  ["armor", ["armadura", "armour", "armor", "cota de malha", "chain mail", "chainmail", "plate mail"]],
  ["helmet", ["elmo", "capacete", "helmet", "helm"]],
  ["bow", ["arco", "bow", "longbow", "shortbow"]],
  ["axe", ["machado", "axe", "hatchet"]],
  ["hammer", ["martelo", "malho", "hammer", "warhammer", "maul"]],
  ["tool", ["ferramenta", "ferramentas", "tool", "tools", "toolkit", "kit de oficio", "kit de artesao"]],
  ["poison", ["veneno", "toxina", "toxico", "poison", "toxin", "venom"]],
  ["potion", ["pocao", "elixir", "potion", "draught"]],
  ["vial", ["frasco", "ampola", "reagente", "reagent", "vial", "flask", "alchemical component"]],
  ["herb", ["erva", "ervas", "herb", "herbs", "planta medicinal"]],
  ["mushroom", ["cogumelo", "cogumelos", "fungo", "mushroom", "mushrooms", "fungus"]],
  ["ring", ["anel", "ring"]],
  ["necklace", ["colar", "pingente", "joia", "joias", "necklace", "pendant", "jewelry", "jewellery"]],
  ["scroll", ["pergaminho", "scroll"]],
  ["book", ["livro", "grimorio", "tomo", "book", "grimoire", "tome", "spellbook"]],
  ["bone", ["osso", "ossos", "bone", "bones"]],
  ["fang", ["presa", "presas", "fang", "fangs", "tusk"]],
  ["tooth", ["dente", "dentes", "tooth", "teeth"]],
  ["claw", ["garra", "garras", "claw", "claws", "talon"]],
  ["paw", ["pata", "patas", "paw", "paws"]],
  ["tail", ["cauda", "rabo", "tail"]],
  ["wing", ["asa", "asas", "wing", "wings"]],
  ["horn", ["chifre", "chifres", "corno", "horn", "horns"]],
  ["scale", ["escama", "escamas", "scale", "scales"]],
  ["feather", ["pena", "penas", "pluma", "feather", "feathers"]],
  ["hide", ["couro", "pele curtida", "pele animal", "hide", "leather", "pelt"]],
  ["meat", ["carne", "meat", "steak"]],
  ["fish", ["peixe", "peixes", "fish"]],
  ["coin", ["moeda", "moedas", "coin", "coins", "gold piece", "silver piece", "copper piece"]],
  ["crystal", ["cristal", "cristais", "crystal", "crystals"]],
  ["gem", ["gema", "gemas", "pedra preciosa", "gem", "gems", "gemstone"]],
  ["ore", ["minerio", "minerios", "ore", "raw ore"]],
  ["metal", ["lingote", "lingotes", "barra de metal", "barra metalica", "metal", "ingot", "ingots", "metal bar"]],
  ["material", ["material", "materiais", "componente", "componentes", "recurso", "recursos", "sucata", "material", "materials", "component", "components", "resource", "resources", "scrap"]],
];

function normalize(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function containsPhrase(text: string, phrase: string): boolean {
  if (!text) return false;
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase) return false;
  return ` ${text} `.includes(` ${normalizedPhrase} `);
}

export function getCraftingItemIcon(id: CraftingItemIconId): CraftingItemIcon {
  return CRAFTING_ITEM_ICONS[id];
}

export function resolveCraftingItemIconId(name?: string, detail?: string): CraftingItemIconId {
  const normalizedName = normalize(name);
  const normalizedDetail = normalize(detail);
  let bestId: CraftingItemIconId = "material";
  let bestScore = 0;

  for (let ruleIndex = 0; ruleIndex < MATCH_RULES.length; ruleIndex += 1) {
    const [id, aliases] = MATCH_RULES[ruleIndex];
    const rulePriority = (MATCH_RULES.length - ruleIndex) * 100;
    for (const alias of aliases) {
      const normalizedAlias = normalize(alias);
      const specificity = normalizedAlias.length;
      const score = containsPhrase(normalizedName, normalizedAlias)
        ? 100000 + rulePriority + specificity
        : containsPhrase(normalizedDetail, normalizedAlias)
          ? 10000 + rulePriority + specificity
          : 0;
      if (score > bestScore) {
        bestId = id;
        bestScore = score;
      }
    }
  }

  return bestId;
}

export function resolveCraftingItemIcon(name?: string, detail?: string): CraftingItemIcon {
  return CRAFTING_ITEM_ICONS[resolveCraftingItemIconId(name, detail)];
}

export function resolveCraftingItemIconPath(name?: string, detail?: string): string {
  return resolveCraftingItemIcon(name, detail).path;
}
