import type { GameState, GmAppliedTool, GmTurnRecovery } from "@/lib/game";
import { buildTurnInput, executeGmTool, extractNarration, extractRefusal, gmInstructions, responseTools } from "@/lib/gm";

export type GmResponse = { output?: Array<Record<string, unknown>>; output_text?: unknown };
type GmRequest = { model: string; instructions: string; input: unknown[]; tools?: unknown[]; toolChoice?: unknown };
type Options = {
  model: string;
  requirePixelVisual?: boolean;
  allowTools?: boolean;
  allowedToolNames?: string[];
  finalizeLastGlory?: boolean;
  onProgress?: (state: GameState) => void;
  isCurrent?: () => boolean;
};

function toolSignature(name: string, argumentsText: string) {
  function stable(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stable);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
  }
  try {
    const args = JSON.parse(argumentsText);
    // Wording can change on retry without changing the mechanical operation.
    if (args && typeof args === "object" && !Array.isArray(args)) delete args.reason;
    return name + ":" + JSON.stringify(stable(args));
  } catch {
    return name + ":" + argumentsText;
  }
}

export function narrationRequestsRoll(text: string) {
  const normalized = text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR").replace(/\*/g, "");
  return normalized.split(/[.!?\n]+/).some((sentence) => {
    if (/\bnao\s+(?:precisa\s+(?:de\s+)?)?(?:role|rolar|faca|fazer)\b/.test(sentence)) return false;
    return /\brole\s+(?:(?:o|os|um|seu|seus)\s+)?(?:\d*d\d+|uma?\s+rolagem|dados?)\b/.test(sentence)
      || (/\brole\b/.test(sentence) && /\b\d*d\d+\b/.test(sentence))
      || /\bfaca\s+(?:uma?\s+)?(?:rolagem|teste)\b/.test(sentence)
      || /\b(?:preciso|aguardo)\s+(?:que\s+voce\s+role|(?:de\s+)?(?:uma?\s+)?rolagem)\b/.test(sentence);
  });
}

function rollNarration(state: GameState, narration: string) {
  const pending = state.pendingRoll;
  if (!pending) return narration;
  const formula = pending.formula ? "Role " + pending.formula : "Use " + (pending.allowedDice?.join(", ") || "os dados indicados");
  return [narration.trim(), pending.reason,
    formula + " para " + pending.label + (pending.target === undefined ? "." : " · CD " + pending.target + "."),
  ].filter(Boolean).join("\n\n");
}

/** Execute a turn with durable checkpoints; retrying never disables the roll interface. */
export async function runGmTurn(
  initial: GameState,
  text: string,
  respond: (payload: GmRequest) => Promise<GmResponse>,
  options: Options,
): Promise<{state: GameState; narration: string; refusal: string}> {
  const allowTools = options.allowTools !== false;
  const previous = initial.gmRecovery?.text === text ? initial.gmRecovery.appliedTools : [];
  const consumed = new Set<number>();
  const appliedTools: GmAppliedTool[] = [...previous];
  const recovery: GmTurnRecovery = {
    text, allowTools, allowedToolNames: options.allowedToolNames,
    finalizeLastGlory: options.finalizeLastGlory, appliedTools,
  };
  let working: GameState = {...initial, gmRecovery: recovery};
  const checkpoint = () => {
    working = {...working, gmRecovery: {...recovery, appliedTools: [...appliedTools]}};
    options.onProgress?.(working);
  };
  const current = () => {
    if (options.isCurrent && !options.isCurrent()) throw new Error("GmTurnCancelled");
  };
  checkpoint();
  if (working.pendingRoll) return {state: {...working, gmRecovery: undefined}, narration: rollNarration(working, ""), refusal: ""};
  const input: unknown[] = buildTurnInput(working, text);
  if (previous.length) input.push({
    role: "developer",
    content: "RETOMADA APÓS ERRO. Estes efeitos já foram aplicados ao estado atual. Não os repita nem gaste recursos novamente. Termine as etapas que faltam; pedidos de rolagem continuam exigindo request_player_roll.\n" + JSON.stringify(previous),
  });
  if (!allowTools) input.push({
    role: "developer",
    content: "Os efeitos desta ação já foram resolvidos pelo motor. Narre suas consequências sem alterar estado nem pedir uma nova rolagem.",
  });
  if (options.allowedToolNames?.length) input.push({
    role: "developer",
    content: "Use somente as ferramentas disponíveis. Não repita alterações persistentes que já aparecem no estado; se precisar de dados, crie a rolagem na interface.",
  });
  if (options.finalizeLastGlory && working.character.death?.status === "last-glory") input.push({
    role: "developer",
    content: "GLÓRIA FINAL: a ação final é um CRÍTICO AUTOMÁTICO. Não peça dados para determinar sucesso; narre o feito e suas consequências.",
  });
  const availableTools = responseTools.filter((tool) => (allowTools || options.requirePixelVisual && tool.name === "scene_render") &&
    (!options.allowedToolNames?.length || options.allowedToolNames.includes(tool.name) || options.requirePixelVisual && tool.name === "scene_render"));
  let narration = "";
  let refusal = "";
  let repairRoll = false;
  let repairVisual = false;
  let visualRepairs = 0;
  let visualUpdated = previous.some(entry=>entry.name === "scene_render");
  let repairAttempts = 0;
  for (let round = 0; round < 12; round++) {
    current();
    const tools = repairRoll ? availableTools.filter((tool) => tool.name === "request_player_roll") : repairVisual ? availableTools.filter(tool=>tool.name === "scene_render") : availableTools;
    const response = await respond({
      model: options.model, instructions: gmInstructions(working.campaign.system), input: [...input],
      ...(tools.length ? {tools} : {}),
      ...(repairRoll ? {toolChoice: {type: "function", name: "request_player_roll"}} : repairVisual ? {toolChoice:{type:"function",name:"scene_render"}} : {}),
    });
    current();
    const output = Array.isArray(response.output) ? response.output : [];
    const calls = output.filter((item) => item.type === "function_call");
    const draft = extractNarration(response);
    narration = draft || narration;
    refusal = extractRefusal(response) || refusal;
    input.push(...output);
    if (!calls.length) {
      if (narration && narrationRequestsRoll(narration)) {
        if (!availableTools.some((tool) => tool.name === "request_player_roll") || repairAttempts++ >= 2) {
          throw new Error("O Mestre pediu uma rolagem sem registrá-la na interface. Tente retomar a resposta; nenhuma rolagem foi inventada.");
        }
        input.push({
          role: "developer",
          content: "A resposta pediu dados apenas no texto. Antes de publicá-la, use request_player_roll para registrar exatamente o teste solicitado, incluindo fórmula, modificadores e tipo (duality para Esperança e Medo em Daggerheart). Não invente resultados nem resolva o teste. Pedido a registrar:\n" + narration,
        });
        narration = "";
        repairRoll = true;
        continue;
      }
      if (narration && options.requirePixelVisual && !visualUpdated && visualRepairs++ < 2) {
        repairVisual=true;input.push({role:"developer",content:"Antes de finalizar, atualize a referência Chatpixel usando scene_render. Reproduza somente a narração já estabelecida, com visibleNpcs completo; não altere regras nem peça novos dados. Narração: "+narration});continue;
      }
      if (narration || refusal) return {state: {...working, gmRecovery: undefined}, narration, refusal};
      continue;
    }
    let visualOnlySucceeded = calls.every(call => call.name === "scene_render");
    for (const call of calls) {
      const name = String(call.name || "");
      const args = String(call.arguments || "{}");
      let result: unknown;
      if (working.pendingRoll && name !== "scene_render") {
        result = {ok: false, waitingForPlayerRoll: true, pendingRoll: working.pendingRoll};
      } else if (!tools.some((tool) => tool.name === name)) {
        result = {ok: false, error: "Esta ferramenta não está disponível nesta etapa."};
      } else {
        const signature = toolSignature(name, args);
        const replayIndex = previous.findIndex((entry, index) =>
          !consumed.has(index) && toolSignature(entry.name, entry.arguments) === signature);
        if (replayIndex >= 0) {
          consumed.add(replayIndex);
          result = previous[replayIndex].result;
        } else {
          const executed = executeGmTool(working, name, args);
          working = executed.state;
          result = executed.result;
          if(name === "scene_render" && result && typeof result === "object" && (result as {ok?:boolean}).ok){visualUpdated=true;repairVisual=false;}
          if (name !== "memory_search" && result && typeof result === "object" && (result as {ok?: boolean}).ok === true) {
            appliedTools.push({name, arguments: args, result});
          }
          checkpoint();
        }
      }
      if (!(result && typeof result === "object" && (result as {ok?:boolean}).ok)) visualOnlySucceeded = false;
      if (name === "scene_render" && result && typeof result === "object" && (result as {ok?:boolean}).ok) {
        try { const bundled = JSON.parse(args).narration; if (typeof bundled === "string" && bundled.trim()) narration = bundled.trim(); } catch {}
      }
      input.push({
        type: "function_call_output", call_id: call.call_id, output: JSON.stringify(result),
        ...(call.caller ? {caller: call.caller} : {}),
      });
    }
    // A successful visual-only batch already contains everything needed to finish.
    // Mechanical tools still receive their normal result/continuation round.
    if (visualOnlySucceeded && narration && !narrationRequestsRoll(narration) && !working.pendingRoll) {
      return {state: {...working, gmRecovery: undefined}, narration, refusal};
    }
    if (working.pendingRoll) {
      return {state: {...working, gmRecovery: undefined}, narration: rollNarration(working, narration), refusal: ""};
    }
  }
  throw new Error("O Mestre não concluiu a resposta. O progresso foi preservado para você retomar sem repetir os efeitos.");
}
