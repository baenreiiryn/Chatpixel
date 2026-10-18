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

O botão de conexão é intencionalmente um placeholder. A integração final deve usar Sign in with ChatGPT / plan sharing quando o aplicativo tiver acesso ao programa correspondente. Nenhuma API key deve ser embutida no cliente.

As tools iniciais ficam em `lib/tools.ts`.

## Persistência

O navegador mantém `localStorage` como cache offline. A sincronização opcional usa Postgres:

- cada campanha recebe um UUID e uma chave de pareamento aleatória;
- o servidor guarda apenas SHA-256 da chave;
- alterações usam `expectedVersion` para impedir last-write-wins silencioso;
- um conflito retorna a versão remota e a UI pede qual versão deve prevalecer;
- quando Sign in with ChatGPT estiver habilitado, a campanha pode ser vinculada à conta verificada.

As credenciais de pareamento ficam apenas nos dispositivos do usuário. Elas não são credenciais OpenAI.

## Sign in with ChatGPT

As rotas `/api/auth/openai/start` e `/api/auth/openai/callback` implementam Authorization Code + PKCE
e validação do ID token por JWKS. O fluxo permanece desativado enquanto `OPENAI_CLIENT_ID` não estiver configurado.

O banco persiste somente a identidade necessária ao OracleRPG e sua sessão própria. Acesso ao plano ChatGPT
é uma capacidade separada. No preview atual, o plan sharing aberto é para runtimes locais/open-source;
um OracleRPG hospedado precisa da habilitação partner apropriada para oferecer esse uso no site.
