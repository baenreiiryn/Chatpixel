# Chatpixel

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

Selecione o alvo no painel ou clique no NPC. Ataques usam a arma equipada, inclusive quando o texto menciona outra arma. Equipar é uma ação separada. O modo local usa regras simples em português, uma ação afirmativa por mensagem, e exibe erro se não entender. Não é uma simulação de GPT.

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

Tipos disponíveis: `spawn`, `equip`, `attack`, `talk`, `remove`, `scene`. IDs são atribuídos pelo motor, não pelo GPT. `dispatch` retorna uma Promise que termina quando as animações terminam e rejeita chamadas concorrentes. Isso é uma interface no navegador, não um endpoint remoto já integrado ao OracleRPG. Não há integração OracleRPG nesta versão.

## Testar

```sh
npm test
```

Testes cobrem criação, alvo por nome, equipamento, impactos, remoção, mudança de cenário, negações, eventos inválidos, limite de NPCs e IDs únicos. Não há dependências npm a instalar.
