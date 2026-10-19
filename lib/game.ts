export type Actor = "player" | "gm-ai";

export type InventoryItem = {
  id: string;
  name: string;
  qty: number;
  detail: string;
  icon: string;
};

export type Quest = {
  id: string;
  title: string;
  status: "active" | "completed";
  stage: string;
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
  sceneSnapshot?: SceneSnapshot;
  imageDraft?: SceneImageDraft;
};

export type EventRecord = {
  id: string;
  actor: Actor;
  label: string;
  createdAt: string;
  reverse?: GameCommand;
};

export type GameState = {
  campaign: {
    name: string;
    system: string;
    session: number;
    scene: string;
  };
  character: {
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
  };
  inventory: InventoryItem[];
  quests: Quest[];
  npcs: Npc[];
  memories: Memory[];
  messages: Message[];
  events: EventRecord[];
};

export type GameCommand =
  | { type: "adjust"; resource: "hp" | "hope" | "stress" | "armor"; amount: number }
  | { type: "inventory"; itemId: string; amount: number }
  | { type: "quest"; questId: string; status: Quest["status"] }
  | { type: "condition"; name: string; active: boolean }
  | { type: "memory"; kind: Memory["kind"]; text: string };

const now = () => new Date().toISOString();
const id = () => Math.random().toString(36).slice(2, 10);

export const initialState: GameState = {
  campaign: {
    name: "As Cinzas de Vael'tharos",
    system: "Daggerheart",
    session: 12,
    scene: "Santuário soterrado · Câmara do Oráculo",
  },
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
    { id: "heart", title: "O Coração de Cinzas", status: "active", stage: "Encontre a porta sob o santuário" },
    { id: "arven", title: "A Promessa de Arven", status: "active", stage: "Recupere o mapa antigo" },
  ],
  npcs: [
    { id: "arven", name: "Arven", role: "Cartógrafo exilado", relation: "friendly", location: "Vael'tharos" },
    { id: "ithran", name: "Ithran", role: "Sacerdote sem templo", relation: "neutral", location: "Santuário soterrado", secret: "Reconhece o selo da Ordem das Cinzas." },
    { id: "vesh", name: "Vesh", role: "Caçadora da Ordem", relation: "hostile", location: "Desconhecido" },
  ],
  memories: [
    { id: "m1", kind: "fact", text: "Arven deve ao grupo a vida da filha.", createdAt: now() },
    { id: "m2", kind: "secret", text: "Ithran reconheceu o selo, mas escondeu sua reação.", createdAt: now() },
    { id: "m3", kind: "event", text: "A Chave Lunar foi encontrada dentro do observatório quebrado.", createdAt: now() },
  ],
  messages: [
    { id: "g1", role: "gm", text: "A porta de pedra não possui fechadura. No centro, um eclipse de prata pulsa no mesmo ritmo que a Chave Lunar em sua mochila.", createdAt: now() },
    { id: "p1", role: "player", text: "Eu retiro a chave, mas antes verifico se Ithran reage de alguma forma.", createdAt: now() },
    { id: "g2", role: "gm", text: "Ithran tenta parecer indiferente. Por um instante, porém, os olhos dele descem até a chave. Ele conhece aquele símbolo.", createdAt: now() },
  ],
  events: [],
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function executeCommand(state: GameState, command: GameCommand, actor: Actor = "player", record = true): GameState {
  const next = structuredClone(state) as GameState;
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
    next.memories.unshift({ id: memoryId, kind: command.kind, text: command.text, createdAt: now() });
    label = "Memória registrada";
  }

  if (record && label) {
    next.events.unshift({ id: id(), actor, label, createdAt: now(), reverse });
  }

  return next;
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
    character: state.character,
    activeQuests: state.quests.filter((quest) => quest.status === "active"),
    presentNpcs: state.npcs.filter((npc) => npc.location === "Santuário soterrado"),
    relevantMemories: state.memories.slice(0, 8),
    recentDialogue: state.messages.slice(-12),
  };
}
