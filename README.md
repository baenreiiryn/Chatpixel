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
- Oracle Bridge local para Sign in with ChatGPT open-source.
- Registro OAuth dinâmico com `dynamic_agent_client`, PKCE e callback em `127.0.0.1`.
- Tokens ChatGPT ficam somente no dispositivo do usuário.
- Catálogo de modelos da própria conta ChatGPT.
- Loop real de Mestre IA com function tools → Command Bus → narração.
- Narração formatada em blocos, separando fala e descrição.
- Snapshot de cena salvo junto das mensagens do Mestre.
- Memórias visuais de personagens (`kind: visual`) usadas na composição de prompts de imagem.
- Botão **Gerar imagem da cena** abaixo da última mensagem do Mestre.

## Rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

Copie `.env.example` para `.env.local` e configure `DATABASE_URL` para habilitar a nuvem.

Para usar o ChatGPT como Mestre neste computador:

```bash
npm run bridge
```

Depois clique em **ChatGPT → Continuar com ChatGPT** no OracleRPG. O primeiro login usa
o registro dinâmico oficial para apps open-source; não é necessário API key, empresa,
client secret ou client ID pré-aprovado.

## Segurança do ChatGPT plan

Credenciais que dão acesso ao plano ChatGPT **não pertencem ao banco do OracleRPG**.
O browser também não recebe access/refresh tokens. O Oracle Bridge guarda as credenciais
em `~/.oraclerpg/bridge.json` e faz a inferência localmente em nome do usuário.

O Vercel/Neon continuam responsáveis somente pela interface e pelos dados persistentes da campanha.

## Imagens de cena

O OracleRPG já monta um prompt visual persistente a partir da mensagem do Mestre, local,
personagens presentes, objetos mencionados e memórias visuais conhecidas.

No preview atual de ChatGPT plan sharing, a OpenAI não oferece a tool hospedada de image
generation nesse fluxo. Por isso o botão prepara e salva o prompt, mas não envia uma chamada
de imagem fingindo compatibilidade. A UI foi feita atrás de uma camada separada para receber
um provider de imagem local/terceiro depois, sem alterar o modelo de memória ou os snapshots.

## Próximas camadas

1. Empacotar o Oracle Bridge como aplicativo desktop instalável.
2. Criar runtime equivalente no app Android.
3. Recuperação semântica de memória por campanha.
4. Regras por sistema (Daggerheart, D&D, Cyberpunk etc.).
