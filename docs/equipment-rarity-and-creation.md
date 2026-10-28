# Equipamentos: raridade e criação

O compêndio organiza seus 365 equipamentos por Comum, Incomum, Raro e Muito raro,
nessa ordem. Dentro de cada grupo, armas, armaduras, consumíveis e itens de saque
mantêm seus nomes e descrições. A busca também considera raridade e estatísticas.

## Classificação

- Armas e armaduras usam o patamar estrutural do pack SRD Foundryborne:
  1 → Comum; 2 → Incomum; 3 → Raro; 4 → Muito raro.
- Nomes como “Espada Longa Lendária” continuam iguais ao texto traduzido. Sua
  classificação de raridade é Muito raro porque se trata de uma arma de patamar 4.
- Consumíveis e itens de saque usam a posição em sua tabela de origem:
  1–24 → Comum; 25–36 → Incomum; 37–48 → Raro; 49–60 → Muito raro.
  As tabelas oficiais usam rolagens sobrepostas. Essa divisão fixa é uma regra de
  equilíbrio do OracleRPG, baseada no menor intervalo de dados capaz de alcançar
  cada resultado; não representa raridades oficiais exclusivas para cada item.
- Equipamento básico e recordações de classe são comuns. Armadura Corporal e
  Talismã de Sangue Vital são consultáveis, mas dependem de cartas específicas e
  não podem ser obtidos gratuitamente na criação.

Os metadados ficam em `lib/compendium/equipment.manifest.json`, incluindo patamar,
posição na tabela, raridade, espaço de arma, mãos e estatísticas em português.
Nenhuma imagem restrita do Foundry é copiada. Os cartões reutilizam os ícones
locais do projeto quando não existe uma arte própria do item.

Atualize com `npm run sync:foundryborne-equipment`, seguido por
`npm run import:daggerheart`. O importador recusa equipamentos sem classificação.
O manifesto e o compêndio gerado são versionados para builds sem acesso às fontes.

## Disponibilidade na criação

| Patamar | Níveis | Raridades disponíveis |
| --- | --- | --- |
| 1 | 1 | Comum |
| 2 | 2–4 | Comum e Incomum |
| 3 | 5–7 | Comum, Incomum e Raro |
| 4 | 8–10 | Comum, Incomum, Raro e Muito raro |

A etapa usa espaços para armadura, arma primária e secundária; exibe o pacote
básico, uma escolha entre Poção de Vida Menor (cura) e Poção de Vigor Menor,
e um item pessoal. A poção é uma seleção única, exibida em dois cartões com
ícones; trocar a opção substitui a poção no inventário, sem conceder as duas.
Essa escolha inicial permanece entre as duas poções menores em todos os patamares.
As sugestões da classe continuam
disponíveis. O item pessoal pode ser uma das recordações da classe ou um item de
saque permitido pelo patamar, substituindo a recordação.

Armadura, armas e item pessoal abrem seletores com busca, filtro de raridade,
estatísticas e efeitos.
Armas de duas mãos limpam e bloqueiam a secundária; ela volta a ficar disponível
ao trocar ou remover a primária. Os espaços podem ser deixados vazios.

Ao reduzir o nível, equipamentos que ultrapassam o novo patamar são removidos.
A mesma regra é validada novamente ao concluir a criação, inclusive para seleções
forjadas ou obsoletas. Itens sem raridade, lendários e derivados de cartas não
passam nessa validação. O inventário preserva `sourceId`, raridade e estatísticas,
para que armadura, limiares e modificadores continuem utilizáveis.

A antiga entrada livre de equipamento mecânico foi substituída pelas escolhas do
catálogo. As recordações narrativas da classe continuam disponíveis.

## Verificação

- Testes de cobertura do importador, agrupamento, disponibilidade cumulativa,
  espaços de equipamento, armas de duas mãos e validação do inventário.
- Fluxo de criação verificado em desktop e celular, incluindo os quatro patamares,
  redução de nível e persistência do equipamento em uma campanha de teste local.
