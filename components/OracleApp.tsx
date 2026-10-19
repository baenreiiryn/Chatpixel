"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { buildContextPacket, executeCommand, GameState, initialState, Message, undoLatest } from "@/lib/game";
import { useCloudSync } from "@/hooks/useCloudSync";
import { useOracleBridge } from "@/hooks/useOracleBridge";
import { buildTurnInput, executeGmTool, extractNarration, extractRefusal, gmInstructions, responseTools } from "@/lib/gm";
import { buildSceneImagePrompt, buildSceneSnapshot, formatNarrationText, latestGmMessage } from "@/lib/scene";
import DaggerheartCompendium from "@/components/DaggerheartCompendium";
import NewCampaignWizard, { type NewCampaignResult } from "@/components/NewCampaignWizard";
import { CLASS_CONFIG, TRAIT_LABELS, TRAIT_ORDER } from "@/lib/characterCreation/daggerheart";
import { daggerheartCompendium, mechanicsSummary, type CompendiumEntry } from "@/lib/compendium/daggerheart";

const STORAGE_KEY = "oraclerpg:campaign:v1";

type View = "session" | "character" | "world" | "memory";
type AppScreen = "home" | "campaign" | "newCampaign" | "compendium" | "settings";

function Resource({
  label,
  value,
  max,
  kind,
  onAdjust,
}: {
  label: string;
  value: number;
  max: number;
  kind: "hp" | "hope" | "stress" | "armor";
  onAdjust: (kind: "hp" | "hope" | "stress" | "armor", amount: number) => void;
}) {
  return (
    <div className="resource">
      <div className="resourceTop"><span>{label}</span><strong>{value}<em>/{max}</em></strong></div>
      <div className="ticks">
        {Array.from({ length: max }).map((_, index) => <i className={index < value ? "filled" : ""} key={index} />)}
      </div>
      <div className="microActions">
        <button onClick={() => onAdjust(kind, -1)} aria-label={`Diminuir ${label}`}>−</button>
        <button onClick={() => onAdjust(kind, 1)} aria-label={`Aumentar ${label}`}>+</button>
      </div>
    </div>
  );
}

function AvatarSigil() {
  return (
    <div className="avatarSigil" aria-hidden="true">
      <span className="orbit orbitA" />
      <span className="orbit orbitB" />
      <span className="eye">◈</span>
    </div>
  );
}

function MessageText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return (
    <div className="messageText">
      {blocks.map((block, index) => <p key={index}>{block}</p>)}
    </div>
  );
}

function findCompendiumEntry(id?: string, name?: string) {
  if (id) {
    const exact = daggerheartCompendium.entries.find((entry) => entry.id === id || entry.sourceId === id);
    if (exact) return exact;
  }
  if (!name) return undefined;
  const normalized = name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
  return daggerheartCompendium.entries.find((entry) =>
    entry.name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR") === normalized
    || entry.originalName?.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR") === normalized
  );
}

function SheetExpandableCard({
  icon,
  title,
  subtitle,
  entry,
  description,
  badge,
}: {
  icon: string;
  title: string;
  subtitle: string;
  entry?: CompendiumEntry;
  description?: string;
  badge?: string;
}) {
  const body = description?.trim() || entry?.description?.trim() || "";
  const mechanics = entry ? mechanicsSummary(entry) : [];
  const canExpand = Boolean(body || mechanics.length);

  if (!canExpand) {
    return (
      <article className="miniCard">
        <b>{icon}</b>
        <div><h3>{title}</h3><p>{subtitle}</p></div>
        {badge && <strong>{badge}</strong>}
      </article>
    );
  }

  return (
    <details className="sheetExpandableCard">
      <summary>
        <b>{icon}</b>
        <div><h3>{title}</h3><p>{subtitle}</p></div>
        <span className={"sheetExpandHint " + (badge ? "badge" : "chevron")}>{badge || "⌄"}</span>
      </summary>
      <div className="sheetExpandableBody">
        {mechanics.length > 0 && (
          <div className="sheetMechanics">
            {mechanics.map((item, index) => (
              <span className={"mechanicChip " + item.kind} key={item.kind + item.label + index}>{item.label}</span>
            ))}
          </div>
        )}
        {body && <p>{body}</p>}
      </div>
    </details>
  );
}

export default function OracleApp() {
  const [state, setState] = useState<GameState>(initialState);
  const [screen, setScreen] = useState<AppScreen>("home");
  const [view, setView] = useState<View>("session");
  const [input, setInput] = useState("");
  const [ready, setReady] = useState(false);
  const [hasSavedCampaign, setHasSavedCampaign] = useState(false);
  const [showConnect, setShowConnect] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [pairInput, setPairInput] = useState("");
  const [syncNote, setSyncNote] = useState("");
  const [gmBusy, setGmBusy] = useState(false);
  const [gmError, setGmError] = useState("");
  const [imageMessageId, setImageMessageId] = useState<string | null>(null);
  const [imageNote, setImageNote] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setState(JSON.parse(saved));
        setHasSavedCampaign(true);
      }
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && hasSavedCampaign) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [ready, hasSavedCampaign, state]);

  const cloud = useCloudSync(state, setState, ready);
  const bridge = useOracleBridge();

  const contextPreview = useMemo(() => buildContextPacket(state), [state]);
  const lastGmMessage = useMemo(() => latestGmMessage(state.messages), [state.messages]);
  const imageMessage = useMemo(
    () => state.messages.find((message) => message.id === imageMessageId),
    [imageMessageId, state.messages],
  );

  const cloudLabel = ({
    local: "somente local",
    connecting: "conectando",
    synced: "sincronizado",
    syncing: "salvando",
    offline: "offline",
    conflict: "conflito",
    error: "erro",
  } as const)[cloud.status];

  const newCampaignAi = {
    connected: Boolean(bridge.account?.connected),
    model: bridge.model,
    respond: bridge.respond,
    onConnect: bridge.connect,
  };

  async function createCloudCampaign() {
    setSyncNote("");
    try {
      await cloud.createCloud();
      setSyncNote("Campanha criada na nuvem. Use o código abaixo no outro dispositivo.");
    } catch {
      setSyncNote("Não foi possível ativar a sincronização.");
    }
  }

  async function joinCloudCampaign() {
    setSyncNote("");
    try {
      await cloud.joinCloud(pairInput);
      setHasSavedCampaign(true);
      setPairInput("");
      setSyncNote("Campanha carregada deste dispositivo.");
    } catch (error) {
      setSyncNote(error instanceof Error ? error.message : "Código inválido.");
    }
  }

  async function copyPairCode() {
    if (!cloud.pairCode) return;
    await navigator.clipboard.writeText(cloud.pairCode);
    setSyncNote("Código copiado.");
  }

  async function prepareSceneImage(message: Message) {
    const snapshot = message.sceneSnapshot || buildSceneSnapshot(state, message.text);
    const prompt = buildSceneImagePrompt(snapshot);
    setState((current) => ({
      ...current,
      messages: current.messages.map((entry) =>
        entry.id === message.id
          ? {
              ...entry,
              sceneSnapshot: snapshot,
              imageDraft: {
                prompt,
                status: "unavailable",
                provider: "chatgpt-plan-sharing",
                createdAt: new Date().toISOString(),
              },
            }
          : entry,
      ),
    }));
    setImageMessageId(message.id);
    setImageNote("");
  }

  async function copySceneImagePrompt() {
    if (!imageMessage?.imageDraft?.prompt) return;
    await navigator.clipboard.writeText(imageMessage.imageDraft.prompt);
    setImageNote("Prompt da cena copiado.");
  }

  function continueCampaign() {
    if (!hasSavedCampaign) return;
    setView("session");
    setScreen("campaign");
  }

  function finishNewCampaign(result: NewCampaignResult) {
    const createdAt = new Date().toISOString();
    const characterName = result.character.name.trim() || "Novo personagem";
    const campaignName = result.campaignName.trim() || "Nova campanha";
    const scene = "Prólogo · Cena inicial";
    const memories: GameState["memories"] = [];
    const remember = (kind: GameState["memories"][number]["kind"], text: string) => {
      memories.push({ id: crypto.randomUUID(), kind, text, createdAt });
    };

    remember(
      "fact",
      `${characterName} é ${result.classEntry.name} (${result.subclassEntry.name}), de herança ${result.ancestry.primary.name}${result.ancestry.secondary ? ` e ${result.ancestry.secondary.name}` : ""}, da comunidade ${result.community.entry.name}.`,
    );
    remember("fact", `Sistema da campanha: ${result.system}. Tom definido: ${result.tone}.`);
    if (result.adventureHook?.trim()) {
      remember("event", `Gancho inicial da aventura: ${result.adventureHook.trim()}`);
    }
    if (result.classFeatures.length) {
      remember("fact", `Características de classe de ${characterName}: ${result.classFeatures.map((feature) => feature.name).join(", ")}.`);
    }
    if (result.subclassFeatures.length) {
      remember("fact", `Características de subclasse de ${characterName}: ${result.subclassFeatures.map((feature) => feature.name).join(", ")}.`);
    }
    if (result.ancestry.features.length) {
      remember("fact", `Características de ancestralidade de ${characterName}: ${result.ancestry.features.map((feature) => feature.name).join(", ")}.`);
    }
    if (result.community.features.length) {
      remember("fact", `Característica de comunidade de ${characterName}: ${result.community.features.map((feature) => feature.name).join(", ")}.`);
    }
    remember(
      "fact",
      `Traços de ${characterName}: ${TRAIT_ORDER.map((trait) => `${TRAIT_LABELS[trait]} ${result.traits[trait] >= 0 ? "+" : ""}${result.traits[trait]}`).join(", ")}.`,
    );
    remember("fact", `Experiências iniciais de ${characterName}: ${result.experiences.map((experience) => `${experience} +2`).join("; ")}.`);
    remember("fact", `Cartas de domínio iniciais de ${characterName}: ${result.domainCards.map((card) => `${card.name} (${card.domain})`).join("; ")}.`);
    if (result.equipment.length) {
      remember("fact", `Equipamento inicial de ${characterName}: ${result.equipment.map((item) => item.name).join(", ")}.`);
    }
    remember("event", result.character.history.trim()
      ? `História de ${characterName}: ${result.character.history.trim()}`
      : `${characterName} inicia sua jornada em ${campaignName}.`);

    if (result.character.appearance?.trim()) {
      remember("visual", `Aparência de ${characterName}: ${result.character.appearance.trim()}`);
    } else if (result.character.image) {
      remember("visual", `${characterName} possui uma imagem de referência visual registrada na ficha.`);
    }

    for (const companion of result.companions) {
      const connection = companion.connection.trim();
      remember(
        "fact",
        connection
          ? `${companion.name} (${companion.role}) acompanha o grupo. Vínculo com ${characterName}: ${connection}`
          : `${companion.name} (${companion.role}) acompanha o grupo e acabou de conhecer ${characterName}.`,
      );
      if (companion.appearance?.trim()) {
        remember("visual", `Aparência de ${companion.name}: ${companion.appearance.trim()}`);
      }
    }

    if (result.animalCompanion) {
      remember(
        "fact",
        `${result.animalCompanion.name} é o companheiro animal de ${characterName}${result.animalCompanion.kind ? ` (${result.animalCompanion.kind})` : ""}.`,
      );
      if (result.animalCompanion.appearance?.trim()) {
        remember("visual", `Aparência de ${result.animalCompanion.name}: ${result.animalCompanion.appearance.trim()}`);
      } else if (result.animalCompanion.image) {
        remember("visual", `${result.animalCompanion.name} possui uma imagem de referência visual registrada na ficha.`);
      }
    }

    const companionNames = result.companions.map((companion) => companion.name);
    const initialMessage = companionNames.length
      ? `${characterName}, sua jornada em ${campaignName} está pronta. ${companionNames.join(", ")} ${companionNames.length === 1 ? "está" : "estão"} com você no início do prólogo. Descreva sua primeira ação quando quiser começar.`
      : `${characterName}, sua jornada em ${campaignName} está pronta. O prólogo aguarda sua primeira ação.`;

    const next: GameState = {
      campaign: {
        name: campaignName,
        system: result.system,
        tone: result.tone,
        adventureHook: result.adventureHook?.trim() || undefined,
        session: 1,
        scene,
      },
      character: {
        id: "player-character",
        name: characterName,
        archetype: `${result.classEntry.name} · ${result.subclassEntry.name}`,
        level: 1,
        hp: 6,
        maxHp: 6,
        hope: 2,
        maxHope: 6,
        stress: 0,
        maxStress: 6,
        armor: result.armorSlots,
        maxArmor: result.armorSlots,
        conditions: [],
        appearance: result.character.appearance?.trim() || undefined,
        daggerheart: {
          class: { id: result.classEntry.id, name: result.classEntry.name },
          subclass: { id: result.subclassEntry.id, name: result.subclassEntry.name },
          classFeatures: result.classFeatures.map((feature) => ({ id: feature.id, name: feature.name })),
          subclassFeatures: result.subclassFeatures.map((feature) => ({ id: feature.id, name: feature.name })),
          ancestry: {
            mixed: result.ancestry.mixed,
            primary: { id: result.ancestry.primary.id, name: result.ancestry.primary.name },
            secondary: result.ancestry.secondary
              ? { id: result.ancestry.secondary.id, name: result.ancestry.secondary.name }
              : undefined,
            features: result.ancestry.features.map((feature) => ({ id: feature.id, name: feature.name })),
          },
          community: {
            id: result.community.entry.id,
            name: result.community.entry.name,
            features: result.community.features.map((feature) => ({ id: feature.id, name: feature.name })),
          },
          traits: result.traits,
          experiences: result.experiences.map((name) => ({ name: name.trim(), bonus: 2 })),
          domains: [...(CLASS_CONFIG[result.classEntry.sourceId || ""]?.domains || Array.from(new Set(result.domainCards.map((card) => card.domain))))],
          domainCards: result.domainCards.map((card) => ({
            id: card.id,
            name: card.name,
            domain: card.domain,
            level: 1,
          })),
          connections: result.companions
            .filter((companion) => companion.connection.trim())
            .map((companion) => ({ npcId: companion.id, text: companion.connection.trim() })),
          history: result.character.history.trim(),
          pronouns: result.character.pronouns.trim() || undefined,
          image: result.character.image || undefined,
          animalCompanion: result.animalCompanion,
        },
      },
      inventory: result.equipment,
      quests: [],
      npcs: result.companions.map((companion) => ({
        id: companion.id,
        name: companion.name,
        role: companion.role,
        relation: "friendly" as const,
        location: scene,
        appearance: companion.appearance.trim() || undefined,
      })),
      memories,
      messages: [{
        id: crypto.randomUUID(),
        role: "gm",
        text: initialMessage,
        createdAt,
      }],
      events: [],
    };
    setState(next);
    setHasSavedCampaign(true);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setView("session");
    setScreen("campaign");
  }

  function goHome() {
    setScreen("home");
    setView("session");
  }

  function connectChatGPT() {
    setShowConnect(true);
  }

  async function logoutChatGPT() {
    await bridge.logout();
    setShowConnect(false);
  }

  function adjust(resource: "hp" | "hope" | "stress" | "armor", amount: number) {
    setState((current) => executeCommand(current, { type: "adjust", resource, amount }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || gmBusy) return;
    const playerMessage = { id: crypto.randomUUID(), role: "player" as const, text, createdAt: new Date().toISOString() };
    let working: GameState = { ...state, messages: [...state.messages, playerMessage] };
    setState(working);
    setInput("");
    setGmError("");
    if (bridge.status !== "ready" || !bridge.account?.connected || !bridge.model) {
      setShowConnect(true);
      return;
    }

    setGmBusy(true);
    try {
      const conversationInput: unknown[] = buildTurnInput(working, text);
      let narration = "";
      let refusal = "";
      let lastOutputTypes: string[] = [];
      let reachedRoundLimit = true;
      for (let round = 0; round < 12; round += 1) {
        const response = await bridge.respond({
          model: bridge.model,
          instructions: gmInstructions(working.campaign.system),
          input: conversationInput,
          tools: responseTools,
        });
        const output = Array.isArray(response.output) ? response.output : [];
        const calls = output.filter((item: Record<string, unknown>) => item.type === "function_call");
        lastOutputTypes = output.map((item: Record<string, unknown>) => String(item.type || "unknown"));
        narration = extractNarration(response) || narration;
        refusal = extractRefusal(response) || refusal;

        // store:false is intentionally stateless. Replay the complete model output,
        // including encrypted reasoning items, before the function outputs.
        conversationInput.push(...output);

        // A reasoning model can return a reasoning-only phase. That is not the
        // final answer: keep sampling until a message, refusal, or tool call arrives.
        if (!calls.length) {
          if (narration || refusal) {
            reachedRoundLimit = false;
            break;
          }
          continue;
        }

        for (const call of calls as Array<Record<string, unknown>>) {
          const executed = executeGmTool(
            working,
            String(call.name || ""),
            String(call.arguments || "{}"),
          );
          working = executed.state;
          conversationInput.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: JSON.stringify(executed.result),
            ...(call.caller ? { caller: call.caller } : {}),
          });
        }
        setState(working);
      }

      // Safety valve: if the model spent every round reasoning/using tools without
      // emitting a message, ask one final pass with tools disabled.
      if (!narration && !refusal && reachedRoundLimit) {
        conversationInput.push({
          role: "developer",
          content: "As alterações solicitadas já foram executadas no OracleRPG. Não use novas ferramentas. Produza agora apenas a narração final coerente com os resultados acima.",
        });
        const finalResponse = await bridge.respond({
          model: bridge.model,
          instructions: gmInstructions(working.campaign.system),
          input: conversationInput,
        });
        narration = extractNarration(finalResponse);
        refusal = extractRefusal(finalResponse);
        if (Array.isArray(finalResponse.output)) {
          lastOutputTypes = finalResponse.output.map((item: Record<string, unknown>) => String(item.type || "unknown"));
        }
      }

      if (!narration && refusal) {
        narration = refusal;
      } else if (!narration) {
        const received = lastOutputTypes.length ? lastOutputTypes.join(", ") : "nenhum item";
        narration = `O Mestre não retornou uma mensagem narrativa. Tipos recebidos: ${received}. O estado da campanha foi preservado.`;
      }
      narration = formatNarrationText(narration);
      const sceneSnapshot = buildSceneSnapshot(working, narration);
      working = {
        ...working,
        messages: [
          ...working.messages,
          {
            id: crypto.randomUUID(),
            role: "gm",
            text: narration,
            createdAt: new Date().toISOString(),
            sceneSnapshot,
          },
        ],
      };
      setState(working);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao consultar o Mestre.";
      setGmError(message);
      setState((current) => ({
        ...current,
        messages: [
          ...current.messages,
          { id: crypto.randomUUID(), role: "system", text: `Mestre IA indisponível: ${message}`, createdAt: new Date().toISOString() },
        ],
      }));
    } finally {
      setGmBusy(false);
    }
  }

  if (screen === "home") {
    return (
      <main className="appShell homeShell">
        <div className="ambient ambientOne" />
        <div className="ambient ambientTwo" />
        <section className="homeScreen">
          <div className="homeBrand">
            <div className="homeSigil"><img src="/oracle-mark.svg" alt="" /></div>
            <small>ORACLE RPG</small>
            <h1>Onde histórias<br />ganham memória.</h1>
            <p>Campanhas persistentes conduzidas pelo seu Mestre IA.</p>
          </div>

          <div className="homeMenu">
            <button className="homeMenuCard primaryCard" onClick={() => setScreen("newCampaign")}>
              <span className="homeMenuIcon">✦</span>
              <div><strong>Nova campanha</strong><small>Comece uma nova história</small></div>
              <b>›</b>
            </button>

            <button className="homeMenuCard" onClick={continueCampaign} disabled={!hasSavedCampaign}>
              <span className="homeMenuIcon">◈</span>
              <div>
                <strong>Continuar campanha</strong>
                <small>{hasSavedCampaign ? state.campaign.name : "Nenhuma campanha salva"}</small>
              </div>
              <b>›</b>
            </button>

            <button className="homeMenuCard" onClick={() => setScreen("compendium")}>
              <span className="homeMenuIcon">⌘</span>
              <div><strong>Compêndio</strong><small>Regras, criaturas, itens e magias</small></div>
              <b>›</b>
            </button>

            <button className="homeMenuCard" onClick={() => setScreen("settings")}>
              <span className="homeMenuIcon">⚙</span>
              <div><strong>Configurações</strong><small>ChatGPT, nuvem e preferências</small></div>
              <b>›</b>
            </button>
          </div>

          <div className="homeFooter">
            <span className={bridge.account?.connected ? "onlineDot connected" : "onlineDot"} />
            {bridge.account?.connected ? "ChatGPT conectado" : "Mestre IA desconectado"}
          </div>
        </section>
      </main>
    );
  }

  if (screen === "newCampaign") {
    return (
      <NewCampaignWizard
        ai={newCampaignAi}
        onBack={goHome}
        onComplete={finishNewCampaign}
      />
    );
  }

  if (screen === "compendium") {
    return <DaggerheartCompendium onBack={goHome} />;
  }

  if (screen === "settings") {
    return (
      <main className="appShell menuPageShell">
        <div className="ambient ambientOne" />
        <div className="ambient ambientTwo" />
        <header className="menuPageHeader">
          <button className="backButton" onClick={goHome}>‹</button>
          <div><small>ORACLE RPG</small><strong>Configurações</strong></div>
        </header>
        <section className="menuPageContent">
          <div className="menuPageIntro"><small>PREFERÊNCIAS</small><h1>Seu Oracle, do seu jeito.</h1></div>
          <div className="settingsList">
            <button onClick={connectChatGPT}>
              <span className="settingsIcon">✦</span>
              <div><strong>ChatGPT</strong><small>{bridge.account?.connected ? bridge.account.name || bridge.account.email || "Conectado" : "Conectar Mestre IA"}</small></div>
              <em className={bridge.account?.connected ? "statusConnected" : ""}>{bridge.account?.connected ? "Conectado" : "Configurar"}</em>
            </button>
            <button onClick={() => setShowSync(true)}>
              <span className="settingsIcon">☁</span>
              <div><strong>Sincronização</strong><small>Campanha entre seus dispositivos</small></div>
              <em>{cloudLabel}</em>
            </button>
            <div className="settingsInfo">
              <span className="settingsIcon">ⓘ</span>
              <div><strong>OracleRPG SWIG</strong><small>Sign in with ChatGPT · canal standalone</small></div>
              <em>v0.2.6+</em>
            </div>
          </div>
        </section>

        {showSync && (
          <div className="modalBackdrop" onClick={() => setShowSync(false)}>
            <section className="connectModal syncModal" onClick={(e) => e.stopPropagation()}>
              <img src="/oracle-mark.svg" alt="" />
              <small>SINCRONIZAÇÃO</small>
              <h2>Campanha em todos os seus dispositivos</h2>
              {!cloud.credentials ? (
                <>
                  <p>Crie uma campanha sincronizada ou abra uma existente usando o código de pareamento.</p>
                  <button className="primary enabled" onClick={createCloudCampaign}>Ativar sincronização</button>
                  <div className="divider"><span>ou</span></div>
                  <label className="pairField"><span>Código existente</span><input value={pairInput} onChange={(event) => setPairInput(event.target.value)} placeholder="campaign-id.chave" /></label>
                  <button className="ghost" onClick={joinCloudCampaign} disabled={!pairInput.trim()}>Abrir campanha sincronizada</button>
                </>
              ) : (
                <>
                  <div className="syncState"><i className={cloud.status} /><div><small>ESTADO DA NUVEM</small><strong>{cloudLabel}</strong></div></div>
                  <button className="pairCode" onClick={copyPairCode}>{cloud.pairCode}</button>
                  <button className="ghost" onClick={() => cloud.fetchRemote()}>Atualizar agora</button>
                </>
              )}
              {syncNote && <p className="modalNote">{syncNote}</p>}
              <button className="closeText" onClick={() => setShowSync(false)}>Fechar</button>
            </section>
          </div>
        )}

        {showConnect && (
          <div className="modalBackdrop" onClick={() => setShowConnect(false)}>
            <section className="connectModal" onClick={(e) => e.stopPropagation()}>
              <img src="/oracle-mark.svg" alt="" />
              <small>MESTRE IA</small>
              <h2>{bridge.account?.connected ? "ChatGPT conectado" : "Conectar com ChatGPT"}</h2>
              {bridge.account?.connected ? (
                <>
                  <p>Conectado como <b>{bridge.account.name || bridge.account.email || "conta ChatGPT"}</b>.</p>
                  <button className="ghost" onClick={logoutChatGPT}>Desconectar</button>
                </>
              ) : bridge.status === "ready" ? (
                <button className="primary enabled" onClick={() => bridge.connect()}>Continuar com ChatGPT</button>
              ) : (
                <p>O runtime local do Oracle ainda não foi detectado.</p>
              )}
              <button className="closeText" onClick={() => setShowConnect(false)}>Fechar</button>
            </section>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="appShell">
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />

      <header className="topbar">
        <button className="brand brandButton" onClick={goHome}>
          <img src="/oracle-mark.svg" alt="" />
          <div><b>ORACLE</b><span>RPG</span></div>
        </button>
        <div className="campaignTitle">
          <small>{state.campaign.system} · Sessão {state.campaign.session}</small>
          <strong>{state.campaign.name}</strong>
        </div>
        <div className="topActions">
          <button className={`cloudStatus ${cloud.status}`} onClick={() => setShowSync(true)}>
            <i /> Nuvem <span>{cloudLabel}</span>
          </button>
          <button className={`connection ${bridge.account?.connected ? "connected" : ""}`} onClick={connectChatGPT}>
            <i /> ChatGPT <span>{bridge.account?.connected ? "conectado" : bridge.status === "missing" ? "bridge offline" : "conectar"}</span>
          </button>
        </div>
      </header>

      <nav className="mobileNav">
        {([
          ["session", "✦", "Sessão"],
          ["character", "◇", "Ficha"],
          ["world", "⌘", "Mundo"],
          ["memory", "◉", "Memória"],
        ] as const).map(([id, icon, label]) => (
          <button className={view === id ? "active" : ""} onClick={() => setView(id)} key={id}><b>{icon}</b>{label}</button>
        ))}
      </nav>

      <section className="workspace">
        <aside className="rail">
          <button className={view === "session" ? "active" : ""} onClick={() => setView("session")}><b>✦</b><span>Sessão</span></button>
          <button className={view === "character" ? "active" : ""} onClick={() => setView("character")}><b>◇</b><span>Personagem</span></button>
          <button className={view === "world" ? "active" : ""} onClick={() => setView("world")}><b>⌘</b><span>Mundo</span></button>
          <button className={view === "memory" ? "active" : ""} onClick={() => setView("memory")}><b>◉</b><span>Memória</span></button>
          <div className="railBottom"><button onClick={() => setShowSync(true)}><b>⚙</b><span>Configurar</span></button></div>
        </aside>

        <section className="content">
          {view === "session" && (
            <div className="sessionGrid">
              <section className="chatPanel panel">
                <div className="panelHeading">
                  <div><small>CENA ATUAL</small><h1>{state.campaign.scene}</h1></div>
                  <span className="livePill">● AO VIVO</span>
                </div>
                <div className="sceneArt">
                  <div className="sceneMoon" />
                  <div className="sceneDoor"><span>◈</span></div>
                  <div className="sceneFog" />
                  <p>O SANTUÁRIO RESPIRA</p>
                </div>
                <div className="messages">
                  {state.messages.map((message) => (
                    <article className={`message ${message.role}`} key={message.id}>
                      <div className="messageAvatar">{message.role === "gm" ? "◈" : state.character.name.slice(0, 1).toUpperCase()}</div>
                      <div className="messageBody">
                        <small>{message.role === "gm" ? "ORACLE · MESTRE" : message.role === "player" ? state.character.name : "SISTEMA"}</small>
                        <MessageText text={message.text} />
                        {message.role === "gm" && lastGmMessage?.id === message.id && (
                          <button className="sceneImageButton" onClick={() => prepareSceneImage(message)}>
                            <span>✦</span> Gerar imagem da cena
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                <form className="composer" onSubmit={submit}>
                  <button type="button" title="Ações rápidas">＋</button>
                  <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={gmBusy ? "O Mestre está narrando..." : "O que você faz?"} disabled={gmBusy} />
                  <button className="send" type="submit" disabled={gmBusy}>{gmBusy ? "…" : "➤"}</button>
                </form>
                <div className="composerHint"><span>{gmError ? gmError : "O estado da campanha é salvo no OracleRPG."}</span><span>{bridge.model || "Mestre local"}</span></div>
              </section>

              <aside className="characterPanel panel">
                <div className="characterHero">
                  {state.character.daggerheart?.image
                    ? <img className="characterHeroPortrait" src={state.character.daggerheart.image} alt={`Retrato de ${state.character.name}`} />
                    : <AvatarSigil />}
                  <div><small>PERSONAGEM ATIVO</small><h2>{state.character.name}</h2><p>{state.character.archetype}</p></div>
                  <button>•••</button>
                </div>
                <div className="resourceGrid">
                  <Resource label="Pontos de Vida" value={state.character.hp} max={state.character.maxHp} kind="hp" onAdjust={adjust} />
                  <Resource label="Esperança" value={state.character.hope} max={state.character.maxHope} kind="hope" onAdjust={adjust} />
                  <Resource label={state.campaign.system === "Daggerheart" ? "Fadiga" : "Estresse"} value={state.character.stress} max={state.character.maxStress} kind="stress" onAdjust={adjust} />
                  <Resource label="Armadura" value={state.character.armor} max={state.character.maxArmor} kind="armor" onAdjust={adjust} />
                </div>
                <div className="conditions">
                  <div className="sectionTitle"><span>Condições</span><button onClick={() => setState((s) => executeCommand(s, { type: "condition", name: "Oculta", active: !s.character.conditions.includes("Oculta") }))}>＋</button></div>
                  <div className="chips">{state.character.conditions.length ? state.character.conditions.map((c) => <span key={c}>◌ {c}</span>) : <em>Nenhuma condição</em>}</div>
                </div>
                <div className="inventory">
                  <div className="sectionTitle"><span>Inventário</span><small>{state.inventory.reduce((sum, i) => sum + i.qty, 0)} itens</small></div>
                  {state.inventory.map((item) => (
                    <div className="itemRow" key={item.id}>
                      <b>{item.icon}</b>
                      <div><strong>{item.name}</strong><small>{item.detail}</small></div>
                      <div className="qty">
                        <button onClick={() => setState((s) => executeCommand(s, { type: "inventory", itemId: item.id, amount: -1 }))}>−</button>
                        <span>{item.qty}</span>
                        <button onClick={() => setState((s) => executeCommand(s, { type: "inventory", itemId: item.id, amount: 1 }))}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
                {state.events.length > 0 && (
                  <button className="undo" onClick={() => setState((s) => undoLatest(s))}>↶ Desfazer · {state.events[0].label}</button>
                )}
              </aside>
            </div>
          )}

          {view === "character" && (
            <section className="widePanel panel">
              <div className="eyebrow">PERSONAGEM</div>
              <div className="profileTop">
                {state.character.daggerheart?.image ? (
                  <img
                    src={state.character.daggerheart.image}
                    alt={`Retrato de ${state.character.name}`}
                    style={{ width: 88, height: 88, borderRadius: 20, objectFit: "cover" }}
                  />
                ) : <AvatarSigil />}
                <div><h1>{state.character.name}</h1><p>{state.character.archetype} · {state.campaign.system}</p></div>
              </div>
              <div className="fourCols">
                <Resource label="PV" value={state.character.hp} max={state.character.maxHp} kind="hp" onAdjust={adjust} />
                <Resource label="Esperança" value={state.character.hope} max={state.character.maxHope} kind="hope" onAdjust={adjust} />
                <Resource label={state.campaign.system === "Daggerheart" ? "Fadiga" : "Estresse"} value={state.character.stress} max={state.character.maxStress} kind="stress" onAdjust={adjust} />
                <Resource label="Armadura" value={state.character.armor} max={state.character.maxArmor} kind="armor" onAdjust={adjust} />
              </div>
              {state.character.daggerheart && (
                <>
                  <h3 className="subhead">Daggerheart</h3>
                  <div className="cardGrid">
                    <SheetExpandableCard
                      icon="◇"
                      title={state.character.daggerheart.class.name}
                      subtitle="Classe"
                      entry={findCompendiumEntry(state.character.daggerheart.class.id, state.character.daggerheart.class.name)}
                    />
                    <SheetExpandableCard
                      icon="△"
                      title={state.character.daggerheart.subclass.name}
                      subtitle="Subclasse"
                      entry={findCompendiumEntry(state.character.daggerheart.subclass.id, state.character.daggerheart.subclass.name)}
                    />
                    <SheetExpandableCard
                      icon="◐"
                      title={state.character.daggerheart.ancestry.secondary
                        ? `${state.character.daggerheart.ancestry.primary.name} + ${state.character.daggerheart.ancestry.secondary.name}`
                        : state.character.daggerheart.ancestry.primary.name}
                      subtitle={state.character.daggerheart.ancestry.mixed ? "Ancestralidade mista" : "Ancestralidade"}
                      description={[
                        findCompendiumEntry(state.character.daggerheart.ancestry.primary.id, state.character.daggerheart.ancestry.primary.name)?.description,
                        state.character.daggerheart.ancestry.secondary
                          ? findCompendiumEntry(state.character.daggerheart.ancestry.secondary.id, state.character.daggerheart.ancestry.secondary.name)?.description
                          : "",
                      ].filter(Boolean).join("\n\n")}
                    />
                    <SheetExpandableCard
                      icon="⌂"
                      title={state.character.daggerheart.community.name}
                      subtitle="Comunidade"
                      entry={findCompendiumEntry(state.character.daggerheart.community.id, state.character.daggerheart.community.name)}
                    />
                  </div>

                  <h3 className="subhead">Traços</h3>
                  <div className="cardGrid">
                    {TRAIT_ORDER.map((trait) => {
                      const value = state.character.daggerheart!.traits[trait];
                      return (
                        <article className="miniCard" key={trait}>
                          <b>{value >= 0 ? "+" : ""}{value}</b>
                          <div><h3>{TRAIT_LABELS[trait]}</h3><p>Traço de personagem</p></div>
                        </article>
                      );
                    })}
                  </div>

                  <h3 className="subhead">Características</h3>
                  <div className="cardGrid">
                    {state.character.daggerheart.classFeatures.map((feature) => (
                      <SheetExpandableCard
                        icon="✦"
                        title={feature.name}
                        subtitle="Característica de classe"
                        entry={findCompendiumEntry(feature.id, feature.name)}
                        key={feature.id}
                      />
                    ))}
                    {state.character.daggerheart.subclassFeatures.map((feature) => (
                      <SheetExpandableCard
                        icon="△"
                        title={feature.name}
                        subtitle="Característica de subclasse"
                        entry={findCompendiumEntry(feature.id, feature.name)}
                        key={feature.id}
                      />
                    ))}
                    {state.character.daggerheart.ancestry.features.map((feature) => (
                      <SheetExpandableCard
                        icon="◐"
                        title={feature.name}
                        subtitle="Característica de ancestralidade"
                        entry={findCompendiumEntry(feature.id, feature.name)}
                        key={feature.id}
                      />
                    ))}
                    {state.character.daggerheart.community.features.map((feature) => (
                      <SheetExpandableCard
                        icon="⌂"
                        title={feature.name}
                        subtitle="Característica de comunidade"
                        entry={findCompendiumEntry(feature.id, feature.name)}
                        key={feature.id}
                      />
                    ))}
                  </div>

                  <h3 className="subhead">Experiências</h3>
                  <div className="cardGrid">
                    {state.character.daggerheart.experiences.map((experience) => (
                      <article className="miniCard" key={experience.name}>
                        <b>+{experience.bonus}</b>
                        <div><h3>{experience.name}</h3><p>Experiência inicial</p></div>
                      </article>
                    ))}
                  </div>

                  {state.character.daggerheart.history && (
                    <>
                      <h3 className="subhead">História</h3>
                      <article className="miniCard characterHistoryCard">
                        <b>◉</b>
                        <div><h3>História do personagem</h3><p>{state.character.daggerheart.history}</p></div>
                      </article>
                    </>
                  )}

                  <h3 className="subhead">Cartas de domínio</h3>
                  <div className="cardGrid">
                    {state.character.daggerheart.domainCards.map((card) => (
                      <SheetExpandableCard
                        icon="✦"
                        title={card.name}
                        subtitle={`${card.domain} · Nível ${card.level}`}
                        entry={findCompendiumEntry(card.id, card.name)}
                        key={card.id}
                      />
                    ))}
                  </div>

                  {(state.character.daggerheart.connections.length > 0 || state.character.daggerheart.animalCompanion) && (
                    <>
                      <h3 className="subhead">Conexões</h3>
                      <div className="cardGrid">
                        {state.character.daggerheart.connections.map((connection) => {
                          const npc = state.npcs.find((entry) => entry.id === connection.npcId);
                          return (
                            <article className="miniCard" key={connection.npcId}>
                              <b>◇</b>
                              <div><h3>{npc?.name || "Companheiro"}</h3><p>{connection.text}</p></div>
                            </article>
                          );
                        })}
                        {state.character.daggerheart.animalCompanion && (
                          <article className="miniCard">
                            {state.character.daggerheart.animalCompanion.image ? (
                              <img
                                src={state.character.daggerheart.animalCompanion.image}
                                alt={`Retrato de ${state.character.daggerheart.animalCompanion.name}`}
                                style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover" }}
                              />
                            ) : <b>◒</b>}
                            <div>
                              <h3>{state.character.daggerheart.animalCompanion.name}</h3>
                              <p>
                                {state.character.daggerheart.animalCompanion.kind || "Companheiro animal"}
                                {state.character.daggerheart.animalCompanion.appearance ? ` · ${state.character.daggerheart.animalCompanion.appearance}` : ""}
                              </p>
                            </div>
                          </article>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
              <h3 className="subhead">Inventário</h3>
              <div className="cardGrid">
                {state.inventory.map((item) => {
                  const entry = findCompendiumEntry(item.id, item.name);
                  const description = entry?.description && entry.description !== item.detail
                    ? [item.detail, entry.description].filter(Boolean).join("\n\n")
                    : item.detail;
                  return (
                    <SheetExpandableCard
                      icon={item.icon}
                      title={item.name}
                      subtitle={entry ? entry.type === "weapon" ? "Arma" : entry.type === "armor" ? "Armadura" : entry.type === "consumable" ? "Consumível" : entry.type === "loot" ? "Item de saque" : "Item" : "Item"}
                      entry={entry}
                      description={description}
                      badge={`×${item.qty}`}
                      key={item.id}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {view === "world" && (
            <section className="widePanel panel">
              <div className="eyebrow">MUNDO VIVO</div>
              <h1>NPCs e Missões</h1>
              <div className="worldCols">
                <div><h3 className="subhead">NPCs conhecidos</h3>{state.npcs.map(npc => <article className="npcCard" key={npc.id}><div className={`relation ${npc.relation}`} /><div><h3>{npc.name}</h3><p>{npc.role}</p><small>{npc.location}</small></div><span>{npc.relation}</span></article>)}</div>
                <div><h3 className="subhead">Missões</h3>{state.quests.map(quest => <article className="questCard" key={quest.id}><div><small>{quest.status === "active" ? "EM ANDAMENTO" : "CONCLUÍDA"}</small><h3>{quest.title}</h3><p>{quest.stage}</p></div><button onClick={() => setState(s => executeCommand(s, { type: "quest", questId: quest.id, status: quest.status === "active" ? "completed" : "active" }))}>{quest.status === "active" ? "Concluir" : "Reabrir"}</button></article>)}</div>
              </div>
            </section>
          )}

          {view === "memory" && (
            <section className="widePanel panel">
              <div className="eyebrow">MEMÓRIA PERSISTENTE</div>
              <div className="memoryHeader"><div><h1>O Oracle lembra do mundo.</h1><p>Esses dados pertencem à campanha, não à janela de contexto do modelo.</p></div><span>{state.memories.length} registros</span></div>
              <div className="memoryList">{state.memories.map(memory => <article key={memory.id}><b>{memory.kind === "secret" ? "◇" : memory.kind === "event" ? "✦" : memory.kind === "visual" ? "◐" : "◉"}</b><div><small>{memory.kind.toUpperCase()}</small><p>{memory.text}</p></div></article>)}</div>
              <details className="contextPreview"><summary>Prévia do pacote de contexto enviado ao Mestre</summary><pre>{JSON.stringify(contextPreview, null, 2)}</pre></details>
            </section>
          )}
        </section>
      </section>

      {showSync && (
        <div className="modalBackdrop" onClick={() => setShowSync(false)}>
          <section className="connectModal syncModal" onClick={(e) => e.stopPropagation()}>
            <img src="/oracle-mark.svg" alt="" />
            <small>SINCRONIZAÇÃO</small>
            <h2>Campanha em todos os seus dispositivos</h2>
            {!cloud.credentials ? (
              <>
                <p>O Oracle pode guardar a campanha na nuvem sem enviar credenciais do ChatGPT. Você pode criar uma campanha sincronizada ou abrir uma existente usando o código de pareamento.</p>
                <button className="primary enabled" onClick={createCloudCampaign}>Ativar sincronização desta campanha</button>
                <div className="divider"><span>ou</span></div>
                <label className="pairField">
                  <span>Código de outro dispositivo</span>
                  <input value={pairInput} onChange={(event) => setPairInput(event.target.value)} placeholder="campaign-id.chave" />
                </label>
                <button className="ghost" onClick={joinCloudCampaign} disabled={!pairInput.trim()}>Abrir campanha sincronizada</button>
              </>
            ) : (
              <>
                <div className="syncState">
                  <i className={cloud.status} />
                  <div><small>ESTADO DA NUVEM</small><strong>{cloudLabel}</strong></div>
                </div>
                <p>Use este código apenas nos seus dispositivos. Ele funciona como uma chave da campanha e não contém sua conta ChatGPT.</p>
                <button className="pairCode" onClick={copyPairCode} title="Copiar código">{cloud.pairCode}</button>
                {cloud.conflict && (
                  <div className="conflictBox">
                    <strong>Dois dispositivos editaram a campanha.</strong>
                    <p>Escolha qual versão deve continuar como fonte da verdade.</p>
                    <div>
                      <button onClick={() => cloud.resolveConflict("remote")}>Usar versão da nuvem</button>
                      <button onClick={() => cloud.resolveConflict("local")}>Usar este dispositivo</button>
                    </div>
                  </div>
                )}
                <button className="ghost" onClick={() => cloud.fetchRemote()}>Atualizar agora</button>
                <button className="dangerGhost" onClick={cloud.disconnectCloud}>Desconectar este dispositivo</button>
              </>
            )}
            {syncNote && <p className="modalNote">{syncNote}</p>}
            <button className="closeText" onClick={() => setShowSync(false)}>Fechar</button>
          </section>
        </div>
      )}

      {showConnect && (
        <div className="modalBackdrop" onClick={() => setShowConnect(false)}>
          <section className="connectModal" onClick={(e) => e.stopPropagation()}>
            <img src="/oracle-mark.svg" alt="" />
            <small>MESTRE IA</small>
            <h2>{bridge.account?.connected ? "ChatGPT conectado" : bridge.status === "missing" ? "Oracle Bridge necessário" : "Conectar com ChatGPT"}</h2>
            {bridge.status === "missing" ? (
              <>
                <p>O plano ChatGPT precisa ser usado pelo runtime local. Inicie o Oracle Bridge neste computador; as credenciais nunca são enviadas ao Vercel ou ao Neon.</p>
                <div className="bridgeCommand"><code>npm install</code><code>npm run bridge</code></div>
                <button className="ghost" onClick={() => bridge.refresh()}>Verificar novamente</button>
              </>
            ) : bridge.account?.connected ? (
              <>
                <p>Conectado localmente como <b>{bridge.account.name || bridge.account.email || "conta ChatGPT"}</b>. O uso da IA conta no limite do próprio plano dessa conta.</p>
                {bridge.models.length > 0 && (
                  <label className="modelPicker">
                    <span>Modelo do Mestre</span>
                    <select value={bridge.model} onChange={(event) => bridge.setModel(event.target.value)}>
                      {bridge.models.map((model) => <option key={model.slug} value={model.slug}>{model.displayName}</option>)}
                    </select>
                  </label>
                )}
                <button className="ghost" onClick={logoutChatGPT}>Desconectar ChatGPT deste dispositivo</button>
              </>
            ) : (
              <>
                <p>O Oracle Bridge está ativo. O login abre no navegador do sistema usando o fluxo open-source oficial; não é necessário API key, empresa ou client secret.</p>
                <button className="primary enabled" onClick={() => bridge.connect()}>Continuar com ChatGPT</button>
              </>
            )}
            <div className="connectFlow"><span>OracleRPG</span><i>→</i><span>Bridge local</span><i>→</i><span>ChatGPT</span></div>
            {bridge.error && <p className="modalNote">{bridge.error}</p>}
            <button className="ghost" onClick={() => setShowConnect(false)}>Continuar em modo manual</button>
          </section>
        </div>
      )}

      {imageMessage && imageMessage.imageDraft && (
        <div className="modalBackdrop" onClick={() => setImageMessageId(null)}>
          <section className="connectModal imageModal" onClick={(event) => event.stopPropagation()}>
            <div className="imageModalIcon">✦</div>
            <small>IMAGEM DA CENA</small>
            <h2>Contexto visual preparado</h2>
            <p>
              O Oracle reuniu a cena, os personagens presentes e as memórias visuais conhecidas.
              A geração de imagem ainda não pode usar o limite do seu plano ChatGPT porque o fluxo
              atual de plan sharing não oferece a tool de image generation.
            </p>
            {imageMessage.sceneSnapshot && (
              <div className="sceneContextCard">
                <strong>{imageMessage.sceneSnapshot.scene}</strong>
                <div className="scenePeople">
                  {imageMessage.sceneSnapshot.participants.map((participant) => (
                    <span key={participant.id}>{participant.name}</span>
                  ))}
                </div>
              </div>
            )}
            <details className="imagePromptPreview">
              <summary>Ver prompt gerado</summary>
              <pre>{imageMessage.imageDraft.prompt}</pre>
            </details>
            <button className="primary enabled" onClick={copySceneImagePrompt}>Copiar prompt da imagem</button>
            {imageNote && <p className="modalNote">{imageNote}</p>}
            <button className="ghost" onClick={() => setImageMessageId(null)}>Fechar</button>
          </section>
        </div>
      )}
    </main>
  );
}

