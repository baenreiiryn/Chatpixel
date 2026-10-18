"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { buildContextPacket, executeCommand, GameState, initialState, undoLatest } from "@/lib/game";

const STORAGE_KEY = "oraclerpg:campaign:v1";

type View = "session" | "character" | "world" | "memory";

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

export default function OracleApp() {
  const [state, setState] = useState<GameState>(initialState);
  const [view, setView] = useState<View>("session");
  const [input, setInput] = useState("");
  const [ready, setReady] = useState(false);
  const [showConnect, setShowConnect] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setState(JSON.parse(saved));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [ready, state]);

  const contextPreview = useMemo(() => buildContextPacket(state), [state]);

  function adjust(resource: "hp" | "hope" | "stress" | "armor", amount: number) {
    setState((current) => executeCommand(current, { type: "adjust", resource, amount }));
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setState((current) => ({
      ...current,
      messages: [...current.messages, { id: crypto.randomUUID(), role: "player", text, createdAt: new Date().toISOString() }],
    }));
    setInput("");
    setShowConnect(true);
  }

  return (
    <main className="appShell">
      <div className="ambient ambientOne" />
      <div className="ambient ambientTwo" />

      <header className="topbar">
        <div className="brand">
          <img src="/oracle-mark.svg" alt="" />
          <div><b>ORACLE</b><span>RPG</span></div>
        </div>
        <div className="campaignTitle">
          <small>{state.campaign.system} · Sessão {state.campaign.session}</small>
          <strong>{state.campaign.name}</strong>
        </div>
        <button className="connection" onClick={() => setShowConnect(true)}>
          <i /> ChatGPT <span>conectar</span>
        </button>
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
          <div className="railBottom"><button onClick={() => setShowConnect(true)}><b>⚙</b><span>Configurar</span></button></div>
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
                      <div className="messageAvatar">{message.role === "gm" ? "◈" : "F"}</div>
                      <div><small>{message.role === "gm" ? "ORACLE · MESTRE" : message.role === "player" ? state.character.name : "SISTEMA"}</small><p>{message.text}</p></div>
                    </article>
                  ))}
                </div>
                <form className="composer" onSubmit={submit}>
                  <button type="button" title="Ações rápidas">＋</button>
                  <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="O que você faz?" />
                  <button className="send" type="submit">➤</button>
                </form>
                <div className="composerHint"><span>O estado da campanha é salvo no OracleRPG.</span><span>Enter para enviar</span></div>
              </section>

              <aside className="characterPanel panel">
                <div className="characterHero">
                  <AvatarSigil />
                  <div><small>PERSONAGEM ATIVO</small><h2>{state.character.name}</h2><p>{state.character.archetype}</p></div>
                  <button>•••</button>
                </div>
                <div className="resourceGrid">
                  <Resource label="Pontos de Vida" value={state.character.hp} max={state.character.maxHp} kind="hp" onAdjust={adjust} />
                  <Resource label="Esperança" value={state.character.hope} max={state.character.maxHope} kind="hope" onAdjust={adjust} />
                  <Resource label="Estresse" value={state.character.stress} max={state.character.maxStress} kind="stress" onAdjust={adjust} />
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
              <div className="profileTop"><AvatarSigil /><div><h1>{state.character.name}</h1><p>{state.character.archetype} · {state.campaign.system}</p></div></div>
              <div className="fourCols">
                <Resource label="PV" value={state.character.hp} max={state.character.maxHp} kind="hp" onAdjust={adjust} />
                <Resource label="Esperança" value={state.character.hope} max={state.character.maxHope} kind="hope" onAdjust={adjust} />
                <Resource label="Estresse" value={state.character.stress} max={state.character.maxStress} kind="stress" onAdjust={adjust} />
                <Resource label="Armadura" value={state.character.armor} max={state.character.maxArmor} kind="armor" onAdjust={adjust} />
              </div>
              <h3 className="subhead">Inventário</h3>
              <div className="cardGrid">{state.inventory.map(item => <article className="miniCard" key={item.id}><b>{item.icon}</b><div><h3>{item.name}</h3><p>{item.detail}</p></div><strong>×{item.qty}</strong></article>)}</div>
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
              <div className="memoryList">{state.memories.map(memory => <article key={memory.id}><b>{memory.kind === "secret" ? "◇" : memory.kind === "event" ? "✦" : "◉"}</b><div><small>{memory.kind.toUpperCase()}</small><p>{memory.text}</p></div></article>)}</div>
              <details className="contextPreview"><summary>Prévia do pacote de contexto enviado ao Mestre</summary><pre>{JSON.stringify(contextPreview, null, 2)}</pre></details>
            </section>
          )}
        </section>
      </section>

      {showConnect && (
        <div className="modalBackdrop" onClick={() => setShowConnect(false)}>
          <section className="connectModal" onClick={(e) => e.stopPropagation()}>
            <img src="/oracle-mark.svg" alt="" />
            <small>MESTRE IA</small>
            <h2>Conectar com ChatGPT</h2>
            <p>A interface e a memória já estão prontas. A autenticação por plano ChatGPT entra aqui quando o acesso <b>Sign in with ChatGPT</b> estiver habilitado para este aplicativo.</p>
            <div className="connectFlow"><span>OracleRPG</span><i>→</i><span>ChatGPT</span><i>→</i><span>Tools</span></div>
            <button className="primary" disabled>Continuar com ChatGPT · aguardando acesso</button>
            <button className="ghost" onClick={() => setShowConnect(false)}>Continuar em modo manual</button>
          </section>
        </div>
      )}
    </main>
  );
}
