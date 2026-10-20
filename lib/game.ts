import {
  CampaignTimeState,
  MINUTES_PER_DAY,
  createCampaignTimeState,
  createDemoCampaignTimeState,
} from "@/lib/campaignTime";

export type Actor = "player" | "gm-ai";

export type RollKind = "attack" | "damage" | "reaction" | "check" | "duality" | "custom";

export type RollSource = "tray" | "slash" | "pending";

export type DiceType = "d2" | "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100";

export type RollDieResult = {
  die: DiceType;
  value: number;
  label?: string;
};

export type PlayerRollRequest = {
  label: string;
  reason: string;
  formula?: string;
  allowedDice?: DiceType[];
  target?: number;
  rollKind?: RollKind;
};

export type PendingPlayerRoll = PlayerRollRequest & {
  id: string;
  rollKind: RollKind;
  requestedAt: string;
  campaignMinute: number;
};

export type RollResolution = {
  total: number;
  formula?: string;
  dice?: RollDieResult[];
  modifier?: number;
  result?: string;
  success?: boolean;
  source?: RollSource;
};

export type RollResultRecord = {
  id: string;
  pendingRollId: string;
  label: string;
  reason: string;
  rollKind: RollKind;
  source: RollSource;
  requestedFormula?: string;
  formula?: string;
  allowedDice?: DiceType[];
  target?: number;
  dice?: RollDieResult[];
  modifier?: number;
  total: number;
  result?: string;
  success?: boolean;
  outcome?: "success" | "failure";
  requestedAt: string;
  requestedCampaignMinute: number;
  resolvedAt: string;
  campaignMinute: number;
};

export type InventoryItem = {
  id: string;
  name: string;
  qty: number;
  detail: string;
  icon: string;
};

export type CharacterTraitName =
  | "agility"
  | "strength"
  | "finesse"
  | "instinct"
  | "presence"
  | "knowledge";

export type CharacterExperience = {
  name: string;
  bonus: number;
};

export type CharacterFeatureRef = {
  id: string;
  name: string;
};

export type CharacterAncestry = {
  mixed: boolean;
  primary: CharacterFeatureRef;
  secondary?: CharacterFeatureRef;
  features: CharacterFeatureRef[];
};

export type CharacterCommunity = CharacterFeatureRef & {
  features: CharacterFeatureRef[];
};

export type CharacterDomainCard = CharacterFeatureRef & {
  domain: string;
  level: number;
};

export type CharacterConnection = {
  npcId: string;
  text: string;
};

export type AnimalCompanion = {
  name: string;
  kind?: string;
  image?: string;
  appearance?: string;
};

export type DaggerheartCharacterData = {
  class: CharacterFeatureRef;
  subclass: CharacterFeatureRef;
  classFeatures: CharacterFeatureRef[];
  subclassFeatures: CharacterFeatureRef[];
  ancestry: CharacterAncestry;
  community: CharacterCommunity;
  traits: Record<CharacterTraitName, number>;
  experiences: CharacterExperience[];
  domains: string[];
  domainCards: CharacterDomainCard[];
  connections: CharacterConnection[];
  history: string;
  pronouns?: string;
  image?: string;
  animalCompanion?: AnimalCompanion;
};

export type Quest = {
  id: string;
  title: string;
  status: "active" | "completed";
  stage: string;
  acceptedAtCampaignMinute?: number;
  deadlineCampaignMinute?: number;
  completedAtCampaignMinute?: number;
};

export type Npc = {
  id: string;
  name: string;
  role: string;
  relation: "friendly" | "neutral" | "hostile";
  location: string;
  secret?: string;
  appearance?: string;
};

export type Memory = {
  id: string;
  kind: "fact" | "event" | "secret" | "visual";
  text: string;
  createdAt: string;
  campaignMinute?: number;
};

export type SceneParticipant = {
  id: string;
  name: string;
  role: string;
  appearance?: string;
  visualMemories: string[];
};

export type SceneSnapshot = {
  scene: string;
  location: string;
  narration: string;
  participants: SceneParticipant[];
  visibleObjects: string[];
  recentContext: string[];
  createdAt: string;
};

export type SceneImageDraft = {
  prompt: string;
  status: "ready" | "unavailable";
  provider?: string;
  createdAt: string;
};

export type Message = {
  id: string;
  role: "gm" | "player" | "system";
  text: string;
  createdAt: string;
  campaignMinute?: number;
  sceneSnapshot?: SceneSnapshot;
  imageDraft?: SceneImageDraft;
};

export type EventRecord = {
  id: string;
  actor: Actor;
  label: string;
  createdAt: string;
  campaignMinute?: number;
  reverse?: GameCommand;
};

export type CampaignCore = {
  name: string;
  system: string;
  tone?: string;
  adventureHook?: string;
  session: number;
  scene: string;
};

export type CharacterState = {
  id: string;
  name: string;
  archetype: string;
  level: number;
  hp: number;
  maxHp: number;
  hope: number;
  maxHope: number;
  stress: number;
  maxStress: number;
  armor: number;
  maxArmor: number;
  conditions: string[];
  appearance?: string;
  daggerheart?: DaggerheartCharacterData;
};

export type CampaignRestartSnapshot = {
  createdAt: string;
  campaign: CampaignCore;
  time: CampaignTimeState;
  character: CharacterState;
  inventory: InventoryItem[];
  quests: Quest[];
  npcs: Npc[];
  memories: Memory[];
  messages: Message[];
};

export type GameState = {
  campaign: CampaignCore & {
    restartSnapshot?: CampaignRestartSnapshot;
  };
  time: CampaignTimeState;
  character: CharacterState;
  inventory: InventoryItem[];
  quests: Quest[];
  npcs: Npc[];
  memories: Memory[];
  messages: Message[];
  events: EventRecord[];
  pendingRoll?: PendingPlayerRoll;
  rollHistory?: RollResultRecord[];
};

function cloneWithoutEmbeddedImages(character: CharacterState): CharacterState {
  const next = structuredClone(character) as CharacterState;
  if (next.daggerheart) {
    next.daggerheart.image = undefined;
    if (next.daggerheart.animalCompanion) {
      next.daggerheart.animalCompanion.image = undefined;
    }
  }
  return next;
}

export function createCampaignRestartSnapshot(state: GameState): CampaignRestartSnapshot {
  const { restartSnapshot: _restartSnapshot, ...campaign } = state.campaign;
  return {
    createdAt: new Date().toISOString(),
    campaign: structuredClone(campaign),
    time: structuredClone(state.time ?? createCampaignTimeState({ seed: `campaign:${state.campaign.name}` })),
    character: cloneWithoutEmbeddedImages(state.character),
    inventory: structuredClone(state.inventory),
    quests: structuredClone(state.quests),
    npcs: structuredClone(state.npcs),
    memories: structuredClone(state.memories),
    messages: structuredClone(state.messages),
  };
}

function creationMemoriesFromLegacy(state: GameState) {
  const timestamps = state.memories
    .map((memory) => Date.parse(memory.createdAt))
    .filter((value) => Number.isFinite(value));
  if (!timestamps.length) return [] as Memory[];
  const first = Math.min(...timestamps);
  return state.memories.filter((memory) => Date.parse(memory.createdAt) === first);
}

function creationInventoryNames(memories: Memory[]) {
  const memory = memories.find((entry) => /Equipamento inicial de .+?:/i.test(entry.text));
  if (!memory) return [] as string[];
  const match = memory.text.match(/Equipamento inicial de .+?:\s*(.+?)\.?$/i);
  if (!match?.[1]) return [];
  return match[1].split(",").map((name) => name.trim()).filter(Boolean);
}

function creationCompanionNames(memories: Memory[]) {
  return memories.flatMap((memory) => {
    const match = memory.text.match(/^(.+?)\s+\([^)]*\)\s+acompanha o grupo/i);
    return match?.[1] ? [match[1].trim()] : [];
  });
}

export function inferLegacyRestartSnapshot(state: GameState): CampaignRestartSnapshot {
  const creationMemories = creationMemoriesFromLegacy(state);
  const initialNames = creationInventoryNames(creationMemories);
  const initialNameSet = new Set(initialNames.map((name) => name.toLocaleLowerCase("pt-BR")));
  const inventory = initialNames.length
    ? state.inventory
        .filter((item) => initialNameSet.has(item.name.toLocaleLowerCase("pt-BR")))
        .map((item) => ({ ...structuredClone(item), qty: 1 }))
    : structuredClone(state.inventory);
  const companionNames = new Set(
    creationCompanionNames(creationMemories).map((name) => name.toLocaleLowerCase("pt-BR")),
  );
  const npcs = companionNames.size
    ? state.npcs.filter((npc) => companionNames.has(npc.name.toLocaleLowerCase("pt-BR")))
    : [];
  const initialMessage = state.messages.find((message) => message.role === "gm") || state.messages[0];
  const { restartSnapshot: _restartSnapshot, ...campaign } = state.campaign;
  const character = cloneWithoutEmbeddedImages(state.character);
  character.level = 1;
  character.hp = 6;
  character.maxHp = 6;
  character.hope = 2;
  character.maxHope = 6;
  character.stress = 0;
  character.maxStress = 6;
  character.armor = state.character.maxArmor;
  character.maxArmor = state.character.maxArmor;
  character.conditions = [];

  return {
    createdAt: new Date().toISOString(),
    campaign: {
      ...structuredClone(campaign),
      session: 1,
      scene: "Prólogo · Cena inicial",
    },
    time: structuredClone(state.time ?? createCampaignTimeState({ seed: `legacy:${state.campaign.name}` })),
    character,
    inventory,
    quests: [],
    npcs: structuredClone(npcs),
    memories: structuredClone(creationMemories),
    messages: initialMessage ? [structuredClone(initialMessage)] : [],
  };
}

export function restartCampaignFromSnapshot(state: GameState): GameState {
  const snapshot = state.campaign.restartSnapshot || inferLegacyRestartSnapshot(state);
  const character = structuredClone(snapshot.character);
  if (character.daggerheart && state.character.daggerheart) {
    character.daggerheart.image = state.character.daggerheart.image;
    if (character.daggerheart.animalCompanion && state.character.daggerheart.animalCompanion) {
      character.daggerheart.animalCompanion.image = state.character.daggerheart.animalCompanion.image;
    }
  }
  return {
    campaign: {
      ...structuredClone(snapshot.campaign),
      restartSnapshot: structuredClone(snapshot),
    },
    time: structuredClone(snapshot.time ?? state.time ?? createCampaignTimeState({ seed: `legacy:${state.campaign.name}` })),
    character,
    inventory: structuredClone(snapshot.inventory),
    quests: structuredClone(snapshot.quests),
    npcs: structuredClone(snapshot.npcs),
    memories: structuredClone(snapshot.memories),
    messages: structuredClone(snapshot.messages),
    events: [],
    pendingRoll: undefined,
    rollHistory: [],
  };
}

export type GameCommand =
  | { type: "adjust"; resource: "hp" | "hope" | "stress" | "armor"; amount: number }
  | { type: "inventory"; itemId: string; amount: number }
  | { type: "quest"; questId: string; status: Quest["status"] }
  | { type: "condition"; name: string; active: boolean }
  | { type: "memory"; kind: Memory["kind"]; text: string }
  | { type: "resolve-roll"; pendingRollId: string; resolution: RollResolution };

const now = () => new Date().toISOString();
const id = () => Math.random().toString(36).slice(2, 10);
const demoTime = createDemoCampaignTimeState();
const demoMinute = demoTime.campaignMinute;

export const initialState: GameState = {
  campaign: {
    name: "As Cinzas de Vael'tharos",
    system: "Daggerheart",
    session: 12,
    scene: "Santuário soterrado · Câmara do Oráculo",
  },
  time: demoTime,
  character: {
    id: "fuyu",
    name: "Fuyu",
    archetype: "Ranger · Nível 5",
    level: 5,
    hp: 5,
    maxHp: 7,
    hope: 3,
    maxHope: 6,
    stress: 2,
    maxStress: 6,
    armor: 2,
    maxArmor: 3,
    conditions: ["Oculta"],
  },
  inventory: [
    { id: "moon-key", name: "Chave Lunar", qty: 1, detail: "Abre selos antigos", icon: "✦" },
    { id: "healing", name: "Poção Rubra", qty: 2, detail: "Recuperação", icon: "◒" },
    { id: "rope", name: "Corda de seda", qty: 1, detail: "15 metros", icon: "⌁" },
  ],
  quests: [
    { id: "heart", title: "O Coração de Cinzas", status: "active", stage: "Encontre a porta sob o santuário", acceptedAtCampaignMinute: demoMinute - 3 * MINUTES_PER_DAY },
    { id: "arven", title: "A Promessa de Arven", status: "active", stage: "Recupere o mapa antigo", acceptedAtCampaignMinute: demoMinute - MINUTES_PER_DAY },
  ],
  npcs: [
    { id: "arven", name: "Arven", role: "Cartógrafo exilado", relation: "friendly", location: "Vael'tharos" },
    { id: "ithran", name: "Ithran", role: "Sacerdote sem templo", relation: "neutral", location: "Santuário soterrado", secret: "Reconhece o selo da Ordem das Cinzas." },
    { id: "vesh", name: "Vesh", role: "Caçadora da Ordem", relation: "hostile", location: "Desconhecido" },
  ],
  memories: [
    { id: "m1", kind: "fact", text: "Arven deve ao grupo a vida da filha.", createdAt: now(), campaignMinute: demoMinute - 2 * MINUTES_PER_DAY },
    { id: "m2", kind: "secret", text: "Ithran reconheceu o selo, mas escondeu sua reação.", createdAt: now(), campaignMinute: demoMinute - 180 },
    { id: "m3", kind: "event", text: "A Chave Lunar foi encontrada dentro do observatório quebrado.", createdAt: now(), campaignMinute: demoMinute - 95 },
  ],
  messages: [
    { id: "g1", role: "gm", text: "A porta de pedra não possui fechadura. No centro, um eclipse de prata pulsa no mesmo ritmo que a Chave Lunar em sua mochila.", createdAt: now(), campaignMinute: demoMinute - 8 },
    { id: "p1", role: "player", text: "Eu retiro a chave, mas antes verifico se Ithran reage de alguma forma.", createdAt: now(), campaignMinute: demoMinute - 4 },
    { id: "g2", role: "gm", text: "Ithran tenta parecer indiferente. Por um instante, porém, os olhos dele descem até a chave. Ele conhece aquele símbolo.", createdAt: now(), campaignMinute: demoMinute },
  ],
  events: [],
  rollHistory: [],
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function executeCommand(state: GameState, command: GameCommand, actor: Actor = "player", record = true): GameState {
  const next = structuredClone(state) as GameState;
  const campaignMinute = next.time?.campaignMinute ?? 0;
  let label = "";
  let reverse: GameCommand | undefined;

  if (command.type === "adjust") {
    const maxKey = ({ hp: "maxHp", hope: "maxHope", stress: "maxStress", armor: "maxArmor" } as const)[command.resource];
    const current = next.character[command.resource];
    const maximum = next.character[maxKey];
    const updated = clamp(current + command.amount, 0, maximum);
    const actual = updated - current;
    next.character[command.resource] = updated;
    label = `${command.resource.toUpperCase()} ${actual >= 0 ? "+" : ""}${actual}`;
    reverse = { ...command, amount: -actual };
  }

  if (command.type === "inventory") {
    const item = next.inventory.find((entry) => entry.id === command.itemId);
    if (item) {
      const before = item.qty;
      item.qty = Math.max(0, item.qty + command.amount);
      const actual = item.qty - before;
      label = `${item.name} ${actual >= 0 ? "+" : ""}${actual}`;
      reverse = { ...command, amount: -actual };
    }
  }

  if (command.type === "quest") {
    const quest = next.quests.find((entry) => entry.id === command.questId);
    if (quest) {
      const old = quest.status;
      quest.status = command.status;
      quest.completedAtCampaignMinute = command.status === "completed" ? campaignMinute : undefined;
      label = `${quest.title}: ${command.status === "completed" ? "concluída" : "reativada"}`;
      reverse = { ...command, status: old };
    }
  }

  if (command.type === "condition") {
    const had = next.character.conditions.includes(command.name);
    next.character.conditions = command.active
      ? Array.from(new Set([...next.character.conditions, command.name]))
      : next.character.conditions.filter((condition) => condition !== command.name);
    label = `${command.name}: ${command.active ? "aplicada" : "removida"}`;
    reverse = { ...command, active: had };
  }

  if (command.type === "memory") {
    const memoryId = id();
    next.memories.unshift({ id: memoryId, kind: command.kind, text: command.text, createdAt: now(), campaignMinute });
    label = "Memória registrada";
  }

  if (command.type === "resolve-roll") {
    const pending = next.pendingRoll;
    const total = Number(command.resolution.total);
    if (pending && pending.id === command.pendingRollId && Number.isFinite(total)) {
      const resolvedAt = now();
      const success = command.resolution.success
        ?? (pending.target === undefined ? undefined : total >= pending.target);
      const resultRecord: RollResultRecord = {
        id: id(),
        pendingRollId: pending.id,
        label: pending.label,
        reason: pending.reason,
        rollKind: pending.rollKind,
        source: command.resolution.source ?? "pending",
        requestedFormula: pending.formula,
        formula: command.resolution.formula?.trim() || pending.formula,
        allowedDice: pending.allowedDice ? [...pending.allowedDice] : undefined,
        target: pending.target,
        dice: command.resolution.dice ? structuredClone(command.resolution.dice) : undefined,
        modifier: command.resolution.modifier,
        total,
        result: command.resolution.result?.trim() || undefined,
        success,
        outcome: success === undefined ? undefined : success ? "success" : "failure",
        requestedAt: pending.requestedAt,
        requestedCampaignMinute: pending.campaignMinute,
        resolvedAt,
        campaignMinute,
      };
      next.pendingRoll = undefined;
      next.rollHistory = [...(next.rollHistory ?? []), resultRecord];
      label = `Rolagem resolvida: ${pending.label} = ${total}`;
    }
  }

  if (record && label) {
    next.events.unshift({ id: id(), actor, label, createdAt: now(), campaignMinute, reverse });
  }

  return next;
}

export function requestPlayerRoll(state: GameState, request: PlayerRollRequest): GameState {
  if (state.pendingRoll) return state;
  const formula = request.formula?.trim() || undefined;
  const allowedDice = request.allowedDice?.length
    ? Array.from(new Set(request.allowedDice))
    : undefined;
  const pendingRoll: PendingPlayerRoll = {
    id: id(),
    label: request.label.trim(),
    reason: request.reason.trim(),
    formula,
    allowedDice,
    target: request.target,
    rollKind: request.rollKind ?? "custom",
    requestedAt: now(),
    campaignMinute: state.time?.campaignMinute ?? 0,
  };
  return {
    ...state,
    pendingRoll,
    rollHistory: state.rollHistory ?? [],
  };
}

export function resolvePendingRoll(
  state: GameState,
  pendingRollId: string,
  resolution: RollResolution,
  actor: Actor = "player",
): GameState {
  return executeCommand(state, { type: "resolve-roll", pendingRollId, resolution }, actor);
}

export function undoLatest(state: GameState): GameState {
  const latest = state.events.find((event) => event.reverse);
  if (!latest?.reverse) return state;
  const next = executeCommand(state, latest.reverse, latest.actor, false);
  next.events = next.events.filter((event) => event.id !== latest.id);
  return next;
}

export function buildContextPacket(state: GameState) {
  return {
    campaign: state.campaign,
    time: state.time,
    character: state.character,
    activeQuests: state.quests.filter((quest) => quest.status === "active"),
    presentNpcs: state.npcs.filter((npc) => npc.location === "Santuário soterrado"),
    relevantMemories: state.memories.slice(0, 8),
    recentDialogue: state.messages.slice(-12),
    pendingRoll: state.pendingRoll ?? null,
    rollHistory: (state.rollHistory ?? []).slice(-12),
  };
}
