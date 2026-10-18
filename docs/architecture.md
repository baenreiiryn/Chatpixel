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

O MVP usa `localStorage` para provar o fluxo sem backend. A versão multi-dispositivo deverá mover o estado para banco remoto mantendo o mesmo formato lógico e um event log append-only.
