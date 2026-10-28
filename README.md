# Chatpixel

## Android — versão 0.2.0

O APK de teste está em [Releases](https://github.com/baenreiiryn/Chatpixel/releases/tag/mobile-v0.2.0). Instale `Chatpixel-0.2.0.apk` em Android 8 ou superior. O jogo já está incluído: o modo local funciona offline e não depende do computador. A tela se adapta a retrato e paisagem, mantendo a resolução lógica do mundo em 1280×720.

No aplicativo, clique em **Continue with ChatGPT**, autorize no navegador do próprio celular e toque em **Voltar ao Chatpixel**. Escolha o modelo e ative **Interpretar com GPT**. A autenticação e a interpretação usam a conexão do celular. Tokens ficam criptografados por uma chave do Android Keystore e não são enviados ao JavaScript. O servidor interno aceita apenas conexões de 127.0.0.1 e protege as APIs por um cookie aleatório HttpOnly. O navegador usa um callback com state, nonce e PKCE; a assinatura e as claims do ID token são verificadas antes de salvar a conta.

O APK é uma compilação de teste assinada com uma chave própria de Chatpixel, reutilizada nas atualizações. O login real depende de consentimento e ainda deve ser validado no celular físico do usuário. Não há integração com OracleRPG nesta versão. Se o Android encerrar o app durante o login, reabra e inicie uma nova tentativa.

Compilação: `gradle -p android testDebugUnitTest lintDebug assembleDebug` com Gradle 8.9, JDK 17 e Android SDK 35. O workflow **Android APK** executa os testes do motor, testes de interface por toque em retrato/paisagem, testes do protocolo OAuth Android e lint antes de publicar o APK e o checksum.

Protótipo HTML/Canvas de RPG guiado por narração, com resolução lógica de **1280 × 720** e interface que se ajusta à tela. Sem dependências de execução. Node.js 22 ou superior.

## Jogar

```sh
npm start
```

Abra **http://127.0.0.1:3210** no mesmo computador que executa o servidor. Clique em **Testar sequência**: um goblin aparece e recebe ataques de espada, arco e cajado. O cenário e os personagens são desenhados por código, sem downloads de imagens.

No modo local, escolha Mestre ou Jogador, escreva uma ação e clique em **Dar vida à cena**. Exemplos:

- Mestre: `Apareceu um goblin chamado Grik.`
- Mestre: `Apareceu um mercador chamado Borin.`
- Jogador: `Ataco Grik com minha arma.`
- Jogador: `Eu equipo um arco.`
- Jogador: `Eu equipo um cajado.`
- Jogador: `Falo com Borin.`
- Mestre: `Grik vai embora.`
- Mestre: `Entramos em uma masmorra.` / `Entramos em uma vila.` / `Voltamos à clareira.`

Selecione o alvo no painel ou clique no NPC. Ataques usam a arma explicitamente mencionada se ela estiver no inventário e a equipam automaticamente. Sem arma mencionada, usam a equipada. Arma ausente bloqueia a ação sem alterar a cena. Os controles de inventário permitem testar posse de espada, arco e cajado. Conversar aproxima o jogador do NPC; viajar troca o ambiente e limpa os NPCs do local anterior. O modo local usa regras simples em português, uma ação afirmativa por mensagem, e exibe erro se não entender. Não é uma simulação de GPT.

A cena é salva no localStorage deste navegador. Reiniciar limpa a cena. Há limite de oito NPCs e uma fila serial de animações. Impactos são visuais: não há dano, rolagens, morte automática ou regras de Daggerheart nesta versão.

## Controle com Sign in with ChatGPT

Clique em **Continue with ChatGPT**, conclua a autorização no navegador e conceda a permissão de uso do plano se quiser interpretar os textos com GPT. O catálogo de modelos vem da conta conectada. A opção **Interpretar com GPT** envia a mensagem e o estado atual da cena; desligá-la permite continuar no modo local.

Implementação para execução local/open source, seguindo a documentação oficial:

- [Registro e login](https://developers.openai.com/siwc/token-sharing-open-source/sign-in)
- [Modelos e inferência](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference)

Usa registro dinâmico (`dynamic_agent_client`), identificador persistente do host, PKCE, state, nonce e validação criptográfica do ID token por JWKS. Credenciais e refresh tokens ficam fora do repositório, em `~/.config/chatpixel/connection.json`, com permissão 0600 em Unix. O navegador recebe apenas um cookie HttpOnly de sessão, nunca os tokens OpenAI. O servidor aceita apenas 127.0.0.1 e valida Host e Origin. Não exponha esse servidor local à internet. Para uma versão hospedada será necessária arquitetura de autenticação e sessões apropriada.

A inferência usa `/v1/responses`, `store:false`, `stream:true` e só entrega eventos após `response.completed`. Eventos passam por validação de tipo e papel; o lote completo é simulado antes de alterar a cena. Falhas e limites de uso são exibidos sem recorrer silenciosamente a outra conta ou API paga.

Sair remove as credenciais locais; para revogar a autorização no provedor, desconecte Chatpixel nas configurações de Sign in with ChatGPT. Após reiniciar o servidor, entre novamente para criar uma sessão de navegador; o registro e o host são reutilizados. O login não dá acesso automático a conversas do ChatGPT. As mensagens devem ser inseridas neste jogo ou, futuramente, encaminhadas pelo OracleRPG.

**Validação:** mecânicas testadas automaticamente com `npm test`. O fluxo OAuth e a inferência estão implementados, mas precisam ser validados com uma conta real e consentimento do usuário; não foram testados com credenciais reais nesta entrega.

## Integração futura com OracleRPG

O motor é independente da interpretação. Em `engine.js`, eventos estruturados controlam a cena; em `renderer.js`, eles viram animações. O adapter do futuro transporte autenticado pode chamar:

```js
await window.chatpixel.dispatch([
  { type: 'spawn', name: 'Grik', kind: 'goblin' }
]);
const state = window.chatpixel.getState();
await window.chatpixel.dispatch([
  { type: 'equip', weapon: 'bow' },
  { type: 'attack', target: state.npcs[0].id }
]);
```

Tipos disponíveis: `spawn`, `equip`, `attack`, `talk`, `remove`, `scene`, `move`, `inventory`. IDs são atribuídos pelo motor, não pelo GPT. `dispatch` retorna uma Promise que termina quando as animações terminam e rejeita chamadas concorrentes. Isso é uma interface no navegador, não um endpoint remoto já integrado ao OracleRPG. Não há integração OracleRPG nesta versão.

## Testar

```sh
npm test
```

Testes cobrem criação, alvo por nome, equipamento, impactos, remoção, mudança de cenário, negações, eventos inválidos, limite de NPCs e IDs únicos. Use `npm ci` para instalar as dependências de testes visuais.


## Versão 0.4.0: mestre e arte modular

Com ChatGPT conectado, use **Aventura** para iniciar uma sessão: o GPT narra como mestre, interpreta NPCs, mantém as últimas 12 entradas de contexto e retorna eventos visuais. A narração é separada das falas no registro. Balões usam `talk.speaker`: `player` para jogador ou ID/ref do NPC. Novos NPCs podem receber `ref` estável em `spawn` e falar no mesmo turno.

O seletor de ambiente oferece 18 cenários: floresta, vila, masmorra, taverna, castelo, caverna, deserto, praia, porto, pântano, montanha, neve, ruínas, templo, cemitério, biblioteca, mercado e acampamento. Elementos são desenhados em Canvas; não dependem de geração de imagens.

`spawn.appearance` combina camadas independentes de cabeça/ancestralidade, corpo, roupa, cabelo, chapéu, barba e acessório, além de cores de pele, cabelo, roupa e detalhes. Consulte `appearanceOptions` em `world.js`. O mestre descreve e seleciona essas peças; a aparência permanece salva. O motor valida as opções e continua aplicando os lotes de eventos de forma atômica. Não é um gerador ilimitado de sprites nem um sistema completo de regras de RPG.


## Versão 0.5.0: viagem e cenários modulares

A viagem usa a cena de origem em quatro camadas de Canvas preparadas uma vez, com deslocamentos diferentes para fundo, chão, elementos e primeiro plano. A caminhada começa durante pedidos de deslocamento reconhecidos, permanece enquanto o GPT prepara a resposta e só chega após validar o lote completo. O personagem atravessa portão de cidade, fachada/porta de loja, passagem de masmorra/caverna ou caminho na vegetação; então a cena nova é aplicada com uma breve revelação. Falhas mantêm a origem. O tempo total inclui a espera real da geração e uma animação curta de chegada.

O evento `scene` aceita `layout` com `ground`, `background` e até 24 `props` posicionáveis. Catálogos, limites e composições padrão estão em `scenery.js`. Há 19 ambientes, incluindo loja. A composição é enviada ao GPT no próximo turno e salva com o estado.

Para futura integração visual com OracleRPG, o adaptador no navegador pode chamar `window.chatpixel.prepareScene({scene:'shop',location:'Loja de Borin'})` antes de preparar o destino; depois `await window.chatpixel.dispatch(events)` valida e conclui a entrada. Em caso de falha use `window.chatpixel.cancelScenePreparation()`. `getTransition()` permite observar a espera sem alterar o estado de jogo. Não há conexão remota OracleRPG implementada ainda. Se o destino só for conhecido após receber os eventos, a viagem começa nesse momento.


## Versão 0.5.1: recuperação do envio

A preparação da viagem passa pela mesma proteção que libera os controles após erros. O ciclo de desenho trata falhas, rejeita animações/transições pendentes e continua recebendo frames. Temporizadores concluem efeitos e chegadas mesmo se os frames forem suspensos; o progresso de aparição nunca fica negativo. O botão **Cancelar espera** interrompe o envio local ou a animação pendente, preserva o texto para nova tentativa e ignora a resposta cancelada. A espera da requisição tem limite de 125 segundos. Operações já aplicadas antes de cancelar permanecem na cena.

Testes de regressão incluem seis turnos consecutivos, resposta tardia após cancelamento, retomada de envio, erro de Canvas e ausência de frames.


## Versão 0.5.2: presença por encontro

Todo evento `scene` inicia um novo encontro, mesmo se tipo e nome do ambiente forem iguais. NPCs anteriores ficam para trás, exceto IDs/ref em `scene.carry`, reservado a acompanhantes explicitamente estabelecidos na narração. Movimento curto com `move` mantém o encontro.

A resposta do mestre inclui `visibleNpcs`, lista completa de até 8 IDs/ref fisicamente presentes ao final do turno. O transporte exige essa lista e acrescenta um evento `cast` ao lote (máximo 11 eventos do modelo + 1 de presença). O motor resolve refs de NPCs criados no mesmo turno, remove quem saiu de vista, limpa seleção/fala referentes a personagens ausentes e rejeita referências inválidas. Memórias e citações não implicam presença física. O protocolo de `dispatch` também aceita `cast` para o futuro adaptador OracleRPG.
