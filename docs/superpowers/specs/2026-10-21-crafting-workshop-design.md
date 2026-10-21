# Crafting Workshop — Design

## Intent

Adicionar ao OracleRPG uma aba **Craft** entre **Ficha** e **Mundo**, inspirada no conceito do módulo Grid Crafter, porém implementada de forma própria e integrada ao estado persistente, inventário, Mestre IA e sistema de rolagens do OracleRPG.

O jogador deve poder:

- usar um grid 3×3 fixo para combinar itens do próprio inventário;
- alternar entre **Mundano**, **Encantamentos** e **Alquimia**;
- selecionar receitas já aprendidas ou experimentar combinações desconhecidas;
- descobrir receitas pela experimentação quando o Mestre considerar a combinação coerente;
- aprender receitas por professores, livros, pergaminhos e outros meios narrativos;
- evoluir separadamente em três progressões de crafting, do nível 0 ao 10;
- rolar para concluir o craft, com dificuldade efetivamente menor conforme o nível da disciplina aumenta;
- obter um item uma categoria de raridade acima em um crítico.

O Mestre IA continua responsável por julgar se uma combinação desconhecida faz sentido e por narrar descoberta, falha e sucesso. O motor do OracleRPG continua responsável por validar estado, inventário, raridade, rolagem, consumo e XP.

## Referência e licença

O Grid Crafter público usa um grid 3×3, livro de receitas, inventário real, receitas descobríveis/ensinadas e dois temas, Forge e Arcane. O repositório é GPLv3. O OracleRPG não copiará código, CSS, templates ou assets do módulo. Será uma implementação clean-room dos conceitos e do fluxo, com identidade visual própria compatível com o OracleRPG.

## Navegação e layout

Adicionar `craft` ao `View` e à navegação desktop/mobile, nesta ordem:

1. Sessão
2. Ficha / Personagem
3. **Craft**
4. Mundo
5. Memória

### Estrutura da tela

No topo:

- título da oficina;
- seletor segmentado de mesa: **Mundano**, **Encantamentos**, **Alquimia**;
- botão **Detalhes**.

Centro da tela:

- grid fixo 3×3;
- seta/fluxo visual;
- slot de resultado;
- botão principal **Craft**;
- pequeno estado textual quando o Mestre estiver avaliando ou uma rolagem estiver pendente.

Abaixo do grid:

- desktop: dois painéis lado a lado, **Receitas** à esquerda e **Inventário** à direita;
- mobile: os mesmos conteúdos em duas abas alternáveis para economizar altura.

O grid permanece visível enquanto as listas abaixo rolam.

### Interação com itens

- desktop: drag-and-drop e clique;
- mobile: tocar no item e depois no slot;
- clicar uma receita conhecida tenta preencher automaticamente o grid com itens disponíveis;
- não permitir reservar mais unidades de um item do que o personagem realmente possui;
- limpar slot por botão `×` ou ação equivalente;
- enquanto uma tentativa estiver aguardando o Mestre/rolagem, o grid fica bloqueado.

## Três mesas e temas

### Mundano — tema Forge

Uso: armas, armaduras, ferramentas e itens comuns.

Visual próprio inspirado em forja: metal escuro, calor, brasas, martelo/forja, brilho âmbar, pequenas faíscas em sucesso.

### Encantamentos — tema Arcane

Uso: encantar itens mundanos, armas, armaduras e poções.

Visual próprio inspirado em bancada arcana: círculo rúnico, violeta/azul, glifos, pulsos de energia e partículas.

### Alquimia — tema novo

Uso: poções, venenos, óleos, reagentes e preparos alquímicos.

Visual: vidro, latão, verde-esmeralda/âmbar, tubos, bolhas, vapor e símbolos alquímicos. A animação de sucesso conduz o brilho dos ingredientes para o slot de resultado.

Os temas serão CSS/SVG próprios; nenhuma arte ou estilo do módulo GPL será copiado.

## Estado persistente

Adicionar ao `GameState`:

```ts
type CraftDiscipline = "mundane" | "enchantment" | "alchemy";
type CraftRarity = "common" | "uncommon" | "rare" | "very-rare" | "legendary";

type CraftProgress = {
  xp: number;
};

type CraftIngredient = {
  slot: number;
  sourceId?: string;
  itemId?: string;
  itemName: string;
  quantity: number;
};

type CraftResultTemplate = {
  id?: string;
  name: string;
  detail: string;
  icon: string;
  rarity: CraftRarity;
  quantity: number;
};

type CraftRecipe = {
  id: string;
  name: string;
  discipline: CraftDiscipline;
  layout: "shaped" | "shapeless";
  ingredients: CraftIngredient[];
  result: CraftResultTemplate;
  baseSlot?: number;
  learnedFrom: "discovery" | "teacher" | "book" | "scroll" | "other";
  learnedAt: string;
};

type CraftAttempt = {
  id: string;
  discipline: CraftDiscipline;
  ingredients: CraftIngredient[];
  recipeId?: string;
  stage: "review" | "awaiting-roll";
  requestedAt: string;
  rarity?: CraftRarity;
  dc?: number;
  successChance?: number;
};

type CraftingState = {
  version: 1;
  progress: Record<CraftDiscipline, CraftProgress>;
  recipes: CraftRecipe[];
  pendingAttempt?: CraftAttempt;
};
```

`InventoryItem` ganhará campos opcionais de suporte a crafting, como `rarity`, `sourceId` e `art`, sem quebrar itens existentes.

Para casar ingredientes de forma estável, a ordem de identidade é: `sourceId` canônico quando existir, depois `itemId`, e somente como fallback o nome normalizado. Assim uma receita continua funcionando quando o personagem consome e depois readquire outro exemplar do mesmo item, sem depender apenas do ID de uma instância.

### Migração e restart

- campanhas existentes recebem `crafting` vazio com 0 XP nas três disciplinas;
- novas campanhas também começam em nível 0 nas três disciplinas;
- `CampaignRestartSnapshot` inclui `crafting`, portanto reiniciar a campanha volta o progresso/receitas ao snapshot inicial;
- cloud sync persiste crafting junto com o restante do `GameState`.

## Progressão de XP

Nível é derivado do XP; não é salvo separadamente.

| Nível | XP acumulado |
|---:|---:|
| 0 | 0 |
| 1 | 100 |
| 2 | 250 |
| 3 | 450 |
| 4 | 700 |
| 5 | 1000 |
| 6 | 1350 |
| 7 | 1750 |
| 8 | 2200 |
| 9 | 2700 |
| 10 | 3250 |

Recompensa automática por craft concluído:

| Resultado | XP |
|---|---:|
| Comum | 20 |
| Incomum | 30 |
| Raro | 45 |
| Muito raro | 65 |
| Lendário por crítico | 90 |

Descobrir uma receita pela primeira vez concede +20 XP na disciplina correspondente.

Falhas não concedem XP automaticamente, evitando grind por tentativas vazias.

### Professores e treinamento

O Mestre terá uma ferramenta de conceder XP de disciplina. Faixas de orientação nas instruções:

- 25–50 XP: dica ou técnica curta;
- 50–100 XP: aula/treino relevante;
- 100–150 XP: instrução intensiva;
- até 200 XP: treinamento excepcional com mestre, downtime importante ou recompensa narrativa rara.

Aprender uma receita por livro/pergaminho não concede XP por si só: conhecimento de receita e domínio técnico são coisas separadas. Um professor pode ensinar a receita e também conceder XP quando a ficção justificar.

## Limites de raridade

Raridade máxima normal:

| Nível | Limite |
|---|---|
| 0–1 | Comum |
| 2–4 | Incomum |
| 5–7 | Raro |
| 8–10 | Muito raro |

Nível 0 também pode tentar **Comum**. Essa é uma decisão de UX para que uma campanha recém-criada não tenha a aba inteira bloqueada; nível 0 representa um novato sem treinamento, não incapacidade absoluta.

Receitas acima do limite podem ser aprendidas por livro/professor e ficam visíveis, porém bloqueadas para produção até o nível necessário.

**Lendário não é uma raridade-base de receita nesta versão.** O Mestre não pode cadastrar uma receita normal Lendária; Lendário existe apenas como resultado de um crítico ao produzir uma receita Muito rara.

## Rolagem e chance de sucesso

### Daggerheart

Usar a infraestrutura existente de Dualidade:

`2d12 + nível da disciplina`

CD por raridade:

| Raridade | CD |
|---|---:|
| Comum | 14 |
| Incomum | 17 |
| Raro | 20 |
| Muito raro | 23 |

Considerando o crítico de Dualidade (dados iguais) como sucesso automático, as chances no ponto em que cada faixa é liberada ficam:

- nível 0, Comum: 50,0%;
- nível 1, Comum: 58,3%;
- nível 2, Incomum: 43,1%;
- nível 3, Incomum: 50,0%;
- nível 4, Incomum: 58,3%;
- nível 5, Raro: 43,1%;
- nível 6, Raro: 50,0%;
- nível 7, Raro: 58,3%;
- nível 8, Muito raro: 43,1%;
- nível 9, Muito raro: 50,0%;
- nível 10, Muito raro: 58,3%.

Itens abaixo do limite do personagem ficam progressivamente mais fáceis; por exemplo, um craft Comum em nível alto se torna quase garantido.

### Outros sistemas

Fallback para campanhas não-Daggerheart:

`1d20 + nível da disciplina`

CDs equivalentes: 11 / 14 / 17 / 20 para Comum / Incomum / Raro / Muito raro. 20 natural é crítico.

## Crítico e raridade acima do limite

Crítico não permite iniciar uma receita de raridade proibida. O personagem inicia uma receita dentro do próprio limite; se o resultado for crítico, o **produto final** sobe uma categoria:

- Comum → Incomum
- Incomum → Raro
- Raro → Muito raro
- Muito raro → Lendário

Assim, no exemplo solicitado, um personagem nível 9 normalmente produz até Muito raro; em um crítico, aquela produção torna-se Lendária.

O item recebe a raridade elevada e uma marca de obra-prima/crítico no detalhe. Como o inventário atual não modela bônus mecânicos universais, o crítico não inventa automaticamente estatísticas adicionais; o Mestre pode narrar a qualidade excepcional e futuras integrações podem dar efeitos específicos.

## Receitas

Receitas podem ser:

- **shaped**: posição no 3×3 importa;
- **shapeless**: apenas a composição/quantidade importa.

O Mestre escolhe isso ao registrar a receita. Mundano tende a shaped; Alquimia/Encantamentos podem usar mais shapeless, mas não há regra rígida.

### Encantamentos e item-base

Receitas de Encantamento podem definir `baseSlot`. Esse slot é o item que será encantado. Em um sucesso, o motor clona/preserva os dados desse item-base (nome, detalhe, ícone/arte e identidade de origem quando fizer sentido) e aplica o resultado/patch da receita sobre ele, em vez de trocar o objeto por um item genérico sem relação com o original. Os demais ingredientes são reagentes consumidos normalmente. Isso permite, por exemplo, encantar exatamente a espada ou poção colocada pelo jogador.

Ao clicar uma receita conhecida:

- preencher automaticamente os slots quando o inventário tiver os ingredientes;
- mostrar faltas quando não houver quantidade suficiente;
- exibir o resultado conhecido como ghost/preview no slot de resultado;
- exibir receita bloqueada quando a raridade ultrapassar o nível atual.

## Descoberta por experimentação

Ao apertar **Craft** sem uma receita conhecida correspondente:

1. o Oracle cria `pendingAttempt` com disciplina e os 9 slots;
2. envia ao Mestre IA os itens exatamente por slot, nível, XP, limite de raridade e tabela de chances permitidas;
3. materiais ainda **não** são consumidos;
4. o Mestre avalia se a combinação faz sentido;
5. se não fizer, usa uma ferramenta de rejeitar tentativa; o estado desbloqueia e nada é gasto;
6. se fizer, usa uma ferramenta para registrar a nova receita a partir da tentativa atual, definindo nome, resultado, raridade e shaped/shapeless;
7. a receita entra imediatamente na lista do jogador e recebe origem `discovery`;
8. o Mestre solicita a rolagem de craft pela ferramenta específica de crafting;
9. a ferramenta calcula fórmula, CD e chance — o modelo não escolhe números arbitrários;
10. após a rolagem, o motor resolve sucesso/falha e o Mestre narra o resultado.

## Receita ensinada/comprada

Durante qualquer cena, o Mestre pode adicionar uma receita por ferramenta quando a ficção estabelecer que o personagem:

- recebeu instrução de um professor;
- comprou/leu um livro;
- encontrou um pergaminho;
- aprendeu por outro meio coerente.

A ferramenta recebe disciplina, layout, ingredientes, resultado, raridade e origem. Não exige tentativa de craft ativa.

## Resolução do craft

### Sucesso

O motor, e não o modelo:

1. revalida que o inventário ainda contém as quantidades reservadas;
2. consome os ingredientes atomicamente;
3. adiciona o resultado ou empilha em item compatível;
4. aplica upgrade de raridade em crítico;
5. concede XP;
6. limpa a tentativa pendente;
7. registra evento/sistema para a sessão;
8. deixa o Mestre narrar o desfecho já resolvido.

### Falha

Na primeira versão, falha **não consome materiais automaticamente**. O grid pode permanecer preenchido para o jogador ajustar ou tentar novamente. Isso evita perda arbitrária e mantém o comportamento previsível. Consumo parcial em falha pode ser adicionado depois como regra opcional.

## Ferramentas do Mestre

Adicionar ferramentas dedicadas:

### `craft_recipe_learn`

Registra receita aprendida/descoberta. Pode usar a tentativa atual como ingredientes (`fromPendingAttempt`) ou receber ingredientes explicitamente para professor/livro/pergaminho.

### `craft_request_roll`

Recebe `recipeId`, valida raridade e inventário, calcula fórmula/CD/chance, atualiza `pendingAttempt` e cria `pendingRoll` usando a infraestrutura existente.

### `craft_reject_attempt`

Encerra uma combinação desconhecida que não faz sentido sem consumir materiais.

### `craft_award_xp`

Concede XP para uma disciplina com motivo obrigatório, limitada a 200 XP por chamada.

O Mestre não recebe uma ferramenta para forçar sucesso ou fabricar item ignorando a rolagem; a resolução final fica no motor.

## Contexto enviado ao Mestre

`buildContextPacket` / `buildTurnInput` passa um resumo de crafting:

- nível e XP das três disciplinas;
- limite de raridade de cada uma;
- receitas conhecidas relevantes;
- tentativa pendente completa;
- chance exata da tentativa quando já há raridade definida.

As instruções do Mestre explicam explicitamente:

- julgar lógica de combinações desconhecidas, não aceitar qualquer mistura;
- descobrir receita antes de pedir rolagem;
- usar `craft_request_roll`, nunca inventar CD/fórmula;
- não narrar sucesso/falha antes da rolagem;
- ensinar receitas e conceder XP apenas quando a ficção justificar.

## Concorrência e segurança de estado

- Craft fica desabilitado quando `gmBusy`, `activeDiceRoll`, `pendingRoll` ou tentativa bloqueada impedir uma nova resolução.
- Tentativas e rolagens continuam vinculadas à campanha/epoch já usado pelo fluxo atual, evitando aplicar resultado na campanha errada.
- Consumo só ocorre após revalidar inventário no estado corrente.
- Ferramentas são idempotentes por IDs/assinaturas quando aplicável.

## Testes

Adicionar `scripts/crafting.test.mjs` cobrindo pelo menos:

1. XP → nível 0–10 e clamp no máximo;
2. limite de raridade por nível;
3. chance/CD Daggerheart por raridade/nível;
4. crítico sobe exatamente uma raridade;
5. reserva do grid não excede quantidade do inventário;
6. matching shaped e shapeless;
7. aprender receita é idempotente;
8. receita acima do nível é conhecida mas não pode ser rolada;
9. `craft_request_roll` cria `pendingRoll` correto;
10. sucesso consome atomicamente e adiciona/empilha resultado;
11. crítico muito raro gera lendário;
12. falha não consome;
13. XP é concedido somente após resolução válida;
14. restart snapshot preserva/restaura crafting;
15. campanhas legadas recebem crafting inicial sem perder estado;
16. tools do Mestre para receita e XP;
17. regressão do fluxo de rolagem pendente existente.

Depois, rodar suíte completa e `tsc --noEmit`.

## Fora de escopo nesta primeira implementação

- desmontagem de itens;
- sons copiados do Grid Crafter;
- editor manual de receitas separado para GM;
- perda automática/aleatória de material na falha;
- estatísticas universais geradas para uma obra-prima crítica;
- marketplace de receitas;
- múltiplos personagens simultâneos dentro da mesma campanha OracleRPG.

Esses pontos podem ser adicionados depois sem mudar o modelo central.
