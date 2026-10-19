import { executeCommand, GameState } from "@/lib/game";
import { oracleTools } from "@/lib/tools";

export const responseTools = oracleTools.map((tool) => ({
  type: "function",
  name: tool.name,
  description: tool.description,
  parameters: tool.inputSchema,
}));

export function gmInstructions(system: string) {
  return [
    "Você é o Mestre de RPG do OracleRPG.",
    `O sistema atual é ${system}.`,
    "Narre em português brasileiro com clareza e atmosfera, sem controlar as decisões do personagem do jogador.",
    "O OracleRPG é a fonte da verdade para estado mecânico, inventário, missões e memória.",
    "Use ferramentas sempre que uma ação alterar dados persistentes ou quando precisar consultar memória.",
    "Não invente valores mecânicos que já estejam no contexto.",
    "Faça alterações mecânicas antes de narrar seus efeitos quando isso for necessário.",
    "Registre em memória apenas fatos relevantes que precisem sobreviver ao contexto recente.",
    "Não revele segredos que o personagem não teria como saber.",
    "Depois das ferramentas, produza a narração final e, quando apropriado, pergunte o que o jogador faz.",
  ].join("\n");
}

export function buildTurnInput(state: GameState, playerText: string) {
  const recent = state.messages.slice(-12).map((message) => ({
    role: message.role,
    text: message.text,
  }));
  return [{
    role: "user",
    content: [
      "ESTADO ATUAL DO ORACLE:",
      JSON.stringify({
        campaign: state.campaign,
        character: state.character,
        inventory: state.inventory,
        activeQuests: state.quests.filter((quest) => quest.status === "active"),
        npcs: state.npcs,
        memories: state.memories.slice(0, 20),
        recentDialogue: recent,
      }),
      "",
      `AÇÃO DO JOGADOR: ${playerText}`,
    ].join("\n"),
  }];
}

export function executeGmTool(
  state: GameState,
  name: string,
  rawArguments: string,
): { state: GameState; result: unknown } {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(rawArguments || "{}");
  } catch {
    return { state, result: { ok: false, error: "Invalid JSON arguments." } };
  }

  if (name === "character_adjust_resource") {
    const resource = args.resource;
    const amount = Number(args.amount);
    if (!["hp", "hope", "stress", "armor"].includes(String(resource)) || !Number.isFinite(amount)) {
      return { state, result: { ok: false, error: "Invalid resource adjustment." } };
    }
    const next = executeCommand(
      state,
      { type: "adjust", resource: resource as "hp" | "hope" | "stress" | "armor", amount },
      "gm-ai",
    );
    return { state: next, result: { ok: true, character: next.character } };
  }

  if (name === "inventory_adjust") {
    const itemId = String(args.itemId || "");
    const amount = Number(args.amount);
    const item = state.inventory.find((entry) => entry.id === itemId);
    if (!item || !Number.isFinite(amount)) {
      return { state, result: { ok: false, error: "Unknown item or invalid amount." } };
    }
    const next = executeCommand(state, { type: "inventory", itemId, amount }, "gm-ai");
    return {
      state: next,
      result: { ok: true, item: next.inventory.find((entry) => entry.id === itemId) },
    };
  }

  if (name === "quest_set_status") {
    const questId = String(args.questId || "");
    const status = String(args.status || "");
    if (!state.quests.some((quest) => quest.id === questId) || !["active", "completed"].includes(status)) {
      return { state, result: { ok: false, error: "Unknown quest or invalid status." } };
    }
    const next = executeCommand(
      state,
      { type: "quest", questId, status: status as "active" | "completed" },
      "gm-ai",
    );
    return { state: next, result: { ok: true, quest: next.quests.find((quest) => quest.id === questId) } };
  }

  if (name === "condition_set") {
    const condition = String(args.name || "").trim();
    const active = Boolean(args.active);
    if (!condition) return { state, result: { ok: false, error: "Condition name is required." } };
    const next = executeCommand(state, { type: "condition", name: condition, active }, "gm-ai");
    return { state: next, result: { ok: true, conditions: next.character.conditions } };
  }

  if (name === "memory_record") {
    const kind = String(args.kind || "");
    const text = String(args.text || "").trim();
    if (!["fact", "event", "secret"].includes(kind) || !text) {
      return { state, result: { ok: false, error: "Invalid memory." } };
    }
    const next = executeCommand(
      state,
      { type: "memory", kind: kind as "fact" | "event" | "secret", text },
      "gm-ai",
    );
    return { state: next, result: { ok: true, memory: next.memories[0] } };
  }

  if (name === "memory_search") {
    const query = String(args.query || "").trim().toLocaleLowerCase("pt-BR");
    const limit = Math.max(1, Math.min(20, Number(args.limit) || 8));
    const words = query.split(/\s+/).filter((word) => word.length > 2);
    const matches = state.memories
      .map((memory) => {
        const haystack = memory.text.toLocaleLowerCase("pt-BR");
        const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
        return { memory, score };
      })
      .filter((entry) => entry.score > 0 || !words.length)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => entry.memory);
    return { state, result: { ok: true, memories: matches } };
  }

  return { state, result: { ok: false, error: `Unknown tool: ${name}` } };
}

export function extractNarration(response: { output?: unknown[]; output_text?: unknown }) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }
  const output = Array.isArray(response.output) ? response.output : [];
  const parts: string[] = [];
  for (const item of output as Array<Record<string, unknown>>) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content as Array<Record<string, unknown>>) {
      if (content.type === "output_text" && typeof content.text === "string") {
        parts.push(content.text);
      } else if (typeof content.text === "string") {
        parts.push(content.text);
      }
    }
  }
  return parts.join("\n").trim();
}

export function extractRefusal(response: { output?: unknown[] }) {
  const output = Array.isArray(response.output) ? response.output : [];
  const parts: string[] = [];
  for (const item of output as Array<Record<string, unknown>>) {
    if (item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content as Array<Record<string, unknown>>) {
      if (content.type === "refusal" && typeof content.refusal === "string") {
        parts.push(content.refusal);
      }
    }
  }
  return parts.join("\n").trim();
}
