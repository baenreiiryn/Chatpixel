# OracleRPG

OracleRPG é uma interface persistente para campanhas em que o ChatGPT atua como Mestre.

## Princípio

- O **OracleRPG é a fonte da verdade**: ficha, recursos, NPCs, missões, memória e histórico de eventos.
- O **ChatGPT é o Mestre**: recebe apenas o contexto relevante, narra e chama ferramentas.
- Alterações manuais e alterações da IA passam pelo mesmo command bus.
- A campanha não depende da duração de uma conversa: o contexto pode ser reconstruído a qualquer turno.

## MVP atual

- UI mobile-first responsiva.
- Campanha demonstrativa em Daggerheart.
- PV, Esperança, Estresse e Armadura editáveis.
- Inventário editável.
- Condições, NPCs e missões.
- Memória persistente e prévia do pacote de contexto.
- Log de alterações com Undo.
- Cache offline em `localStorage`.
- Sincronização opcional em Postgres/Neon com pareamento entre dispositivos.
- Versionamento otimista e resolução explícita de conflitos.
- Fluxo OIDC de `Continue with ChatGPT` preparado para o client ID oficial.
- Campanhas podem ser vinculadas à identidade ChatGPT quando o login estiver habilitado.

## Rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

Copie `.env.example` para `.env.local` e configure `DATABASE_URL` para habilitar a nuvem.
As variáveis `OPENAI_CLIENT_ID`, `OPENAI_CLIENT_SECRET` e `OPENAI_REDIRECT_URI`
só são necessárias quando o aplicativo receber credenciais oficiais de Sign in with ChatGPT.

## Segurança do ChatGPT plan

Credenciais que dão acesso ao plano ChatGPT **não pertencem ao banco do OracleRPG**.
O banco remoto contém campanha, memória e sessões de identidade do próprio Oracle.
Plan sharing deve seguir o fluxo permitido pela OpenAI para o tipo de distribuição escolhido.

No preview atual, o fluxo aberto de plan sharing é voltado a apps open-source que executam
localmente; um site hospedado precisa do acesso comercial/partner correspondente.

## Próximas camadas

1. Sign in with ChatGPT / plan sharing quando o app tiver o client ID e acesso apropriado.
2. Tool schema do Mestre apontando para o command bus.
3. Recuperação semântica de memória por campanha.
4. Regras por sistema (Daggerheart, D&D, Cyberpunk etc.).
