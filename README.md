# OracleRPG SWIG

OracleRPG é uma interface persistente para campanhas em que o ChatGPT atua como Mestre.

Esta é a linha **standalone / Sign in with ChatGPT** do projeto. Ela é mantida separadamente
da versão Plugin/MCP do OracleRPG. Os APKs desta linha recebem atualizações pelo repositório
`baenreiiryn/RPGptSWIG` e carregam a interface hospedada em
`https://oraclerpg-swig.vercel.app`.

## Compêndio

O app inclui um compêndio Daggerheart PT-BR otimizado para consulta em mesa: regras,
classes, ancestralidades, comunidades, subclasses, cartas de domínio e adversários.
O pipeline e as fontes estão documentados em `docs/daggerheart-compendium.md`.

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
generation nesse fluxo. Por isso o botão de geração fica oculto; a infraestrutura de snapshot e
prompt continua no código para ser reativada quando a tool estiver disponível, sem fingir
compatibilidade nem alterar o modelo de memória.

Como alternativa disponível hoje, a aba Sessão pode usar a tool hospedada de **Web Search**
para buscar uma referência visual existente na web. Quando o Mestre muda de ambiente usando
`scene_set`, o painel fixo da cena busca uma nova imagem e exibe também um link para a fonte.

Ao terminar a criação do personagem — e também ao usar **Recomeçar campanha** — o Mestre inicia
a primeira cena automaticamente a partir das escolhas de criação. O jogador já entra na Sessão
com a ficção em andamento; não é mais necessário enviar uma primeira ação apenas para começar o prólogo.

## Próximas camadas

1. Empacotar o Oracle Bridge como aplicativo desktop instalável.
2. Criar runtime equivalente no app Android.
3. Recuperação semântica de memória por campanha.
4. Regras por sistema (Daggerheart, D&D, Cyberpunk etc.).
