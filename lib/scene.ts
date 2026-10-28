import type { GameState, Message, SceneParticipant, SceneSnapshot } from "@/lib/game";

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function mentioned(text: string, name: string) {
  return new RegExp(`\\b${escapeRegex(name)}\\b`, "iu").test(text);
}

function locationMatches(scene: string, location: string) {
  const normalizedScene = scene.toLocaleLowerCase("pt-BR");
  const normalizedLocation = location.toLocaleLowerCase("pt-BR");
  return normalizedScene.includes(normalizedLocation)
    || normalizedLocation.includes(normalizedScene.split("·")[0].trim());
}

function visualMemoriesFor(state: GameState, name: string) {
  const visualTerms = [
    "aparência", "cabelo", "cabelos", "olho", "olhos", "pele", "rosto", "altura",
    "alto", "alta", "baixo", "baixa", "roupa", "roupas", "veste", "vestes", "armadura",
    "cicatriz", "tatuagem", "marca", "orelhas", "chifres", "cauda", "asas", "barba",
    "corpo", "postura", "máscara", "chapéu", "manto", "capa",
  ];
  return state.memories
    .filter((memory) => {
      if (!mentioned(memory.text, name) || memory.kind === "secret") return false;
      if (memory.kind === "visual") return true;
      if (memory.kind !== "fact") return false;
      const normalized = memory.text.toLocaleLowerCase("pt-BR");
      return visualTerms.some((term) => normalized.includes(term));
    })
    .slice(0, 6)
    .map((memory) => memory.text);
}

export function formatNarrationText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/([.!?…])\s+—\s+/g, "$1\n\n— ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function buildSceneSnapshot(state: GameState, narration: string): SceneSnapshot {
  const recentMessages = state.messages.slice(-8);
  const recentText = [...recentMessages.map((message) => message.text), narration].join("\n");

  const participants: SceneParticipant[] = [{
    id: state.character.id,
    name: state.character.name,
    role: state.character.archetype,
    appearance: state.character.appearance,
    visualMemories: visualMemoriesFor(state, state.character.name),
  }];

  for (const npc of state.npcs) {
    const isPresent = mentioned(recentText, npc.name)
      || locationMatches(state.campaign.scene, npc.location);
    if (!isPresent) continue;
    participants.push({
      id: npc.id,
      name: npc.name,
      role: npc.role,
      appearance: npc.appearance,
      visualMemories: visualMemoriesFor(state, npc.name),
    });
  }

  const visibleObjects = state.inventory
    .filter((item) => item.qty > 0 && mentioned(recentText, item.name))
    .map((item) => `${item.name}: ${item.detail}`);

  return {
    scene: state.campaign.scene,
    location: state.campaign.scene.split("·")[0].trim(),
    narration,
    participants,
    visibleObjects,
    recentContext: recentMessages.slice(-4).map((message) =>
      `${message.role === "gm" ? "Mestre" : message.role === "player" ? state.character.name : "Sistema"}: ${message.text}`,
    ),
    createdAt: new Date().toISOString(),
  };
}

export function buildSceneImagePrompt(snapshot: SceneSnapshot) {
  const participants = snapshot.participants.map((participant, index) => {
    const knownAppearance = [
      participant.appearance,
      ...participant.visualMemories,
    ].filter(Boolean);
    return [
      `${index + 1}. ${participant.name} — ${participant.role}`,
      knownAppearance.length
        ? `Características visuais conhecidas: ${knownAppearance.join(" | ")}`
        : "Características visuais ainda não registradas; mantenha um design coerente e evite detalhes identificadores excessivamente específicos.",
    ].join("\n");
  }).join("\n\n");

  const objects = snapshot.visibleObjects.length
    ? snapshot.visibleObjects.map((object) => `- ${object}`).join("\n")
    : "- Preserve apenas objetos explicitamente mencionados na cena.";

  return [
    "Crie uma ilustração cinematográfica vertical de fantasia para representar exatamente esta cena de RPG.",
    "Não inclua texto, legendas, interface, balões ou marcas d'água.",
    "Priorize continuidade visual dos personagens e do local. Não revele segredos que não sejam visualmente aparentes.",
    "",
    `LOCAL: ${snapshot.location}`,
    `CENA: ${snapshot.scene}`,
    "",
    "NARRAÇÃO QUE DEVE SER REPRESENTADA:",
    snapshot.narration,
    "",
    "PERSONAGENS PRESENTES:",
    participants,
    "",
    "OBJETOS VISÍVEIS IMPORTANTES:",
    objects,
    "",
    "CONTEXTO IMEDIATAMENTE ANTERIOR:",
    snapshot.recentContext.join("\n"),
    "",
    "COMPOSIÇÃO:",
    "- enquadramento vertical 4:5, apropriado para tela de celular",
    "- fantasia sombria cinematográfica, iluminação atmosférica",
    "- foco na interação e linguagem corporal dos personagens",
    "- consistência de roupas, traços e equipamentos conhecidos",
    "- sem inventar personagens extras",
  ].join("\n");
}

export function latestGmMessage(messages: Message[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "gm") return messages[index];
  }
  return undefined;
}
