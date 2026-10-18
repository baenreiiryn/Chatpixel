# Arquitetura do OracleRPG

## Regra central

O OracleRPG, e não a conversa do modelo, é a fonte da verdade da campanha.

O ChatGPT funciona como Mestre e recebe um pacote de contexto reconstruído a cada turno. Ele pode ler o estado e pedir mudanças através de tools. O jogador pode executar as mesmas mudanças manualmente pela interface.

```text
Jogador ─┐
         ├─> Command Bus ─> Estado ─> UI
Mestre IA┘                    │
                             ├─ eventos
                             └─ memória
```

## Camadas de memória

1. **Estado atual**: PV, recursos, inventário, condições, posição, missões.
2. **Eventos**: alterações mecânicas e fatos observáveis em ordem cronológica.
3. **Conhecimento**: fatos, segredos e quem sabe cada informação.
4. **Narrativa recente**: últimas mensagens e resumo da cena/sessão.
5. **Memória semântica**: recuperação por relevância quando a campanha crescer.

## Context Builder

O modelo nunca deve receber a campanha inteira por padrão. O Context Builder seleciona:

- instruções do sistema de RPG;
- estado do personagem;
- cena atual;
- NPCs presentes;
- missões relevantes;
- memórias relacionadas ao pedido;
- diálogo recente.

O protótipo já expõe `buildContextPacket()` em `lib/game.ts`.

## Command Bus

Toda alteração deve passar pela mesma função, independentemente de quem iniciou a ação:

- jogador pela UI: `actor = player`;
- Mestre por tool call: `actor = gm-ai`.

Isso permite auditoria, Undo e correção manual.

## Integração ChatGPT

O site nunca guarda tokens ChatGPT. O `Oracle Bridge` em `bridge/server.mjs` roda em
`127.0.0.1:31415` e implementa o fluxo open-source de Sign in with ChatGPT:

1. cria um `ext_agent_host_id` persistente;
2. usa `dynamic_agent_client` na primeira autorização;
3. abre o navegador do sistema para OAuth com PKCE;
4. recebe o callback em `127.0.0.1`;
5. valida o ID token por JWKS e exige `chatgpt.tokens.use.direct`;
6. persiste as credenciais somente em `~/.oraclerpg/bridge.json`;
7. lista os modelos disponíveis para a conta;
8. chama `POST /v1/responses` com `store:false` e `stream:true`;
9. devolve somente o resultado ao browser.

O browser recebe tool calls, executa `executeGmTool()` contra o mesmo Command Bus da UI
manual, envia `function_call_output` de volta ao modelo e repete até chegar à narração final.

As tools ficam em `lib/tools.ts`; a orquestração fica em `lib/gm.ts`.

## Persistência

O navegador mantém `localStorage` como cache offline. A sincronização opcional usa Postgres:

- cada campanha recebe um UUID e uma chave de pareamento aleatória;
- o servidor guarda apenas SHA-256 da chave;
- alterações usam `expectedVersion` para impedir last-write-wins silencioso;
- um conflito retorna a versão remota e a UI pede qual versão deve prevalecer;

As credenciais de pareamento ficam apenas nos dispositivos do usuário. Elas não são credenciais OpenAI.

## Sign in with ChatGPT

O OracleRPG usa o fluxo open-source/local, sem client ID de parceiro. Login e inferência
acontecem no Oracle Bridge local. Vercel e Neon nunca recebem access token, refresh token
ou ID token da conta ChatGPT.

O bridge aceita por padrão apenas `https://oraclerpg.vercel.app`,
`http://localhost:3000` e `http://127.0.0.1:3000`. Outras origens precisam ser adicionadas
explicitamente por `ORACLE_ALLOWED_ORIGINS`.
