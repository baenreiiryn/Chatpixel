# Compêndio Daggerheart

O compêndio do OracleRPG é uma representação de consulta, não um VTT.

## Fontes

- Tradução PT-BR não oficial:
  `https://github.com/etiagoabreu/daggerheart-translation-pt-BR`
- Artes de adversários:
  `https://github.com/mordachai/art-for-daggerheart`
- Daggerheart SRD:
  `https://www.daggerheart.com/srd/`
- Metadados estruturais de subclasses (Foundryborne/DPCGL):
  `https://github.com/Foundryborne/daggerheart`

O repositório de tradução declara licença MIT em seu README e identifica o conteúdo como
tradução não oficial do SRD. O repositório de artes declara as imagens como CC0.
Daggerheart e seu SRD pertencem à Darrington Press e são disponibilizados sob a licença
comunitária aplicável ao sistema.

## O que é importado

O Oracle não importa metadados de mapa, token, automações de Foundry ou dados de interface
do VTT. A versão atual mantém:

- regras rápidas essenciais;
- classes e características de classe;
- ancestralidades e características;
- comunidades e características;
- subclasses e características;
- cartas de domínio;
- adversários com nome, descrição, motivações/táticas e retrato.

Descrições de características são analisadas para destacar automaticamente:

- custo em Esperança, Fadiga, Armadura, Vida ou Medo;
- fórmulas de dano;
- testes e Testes de Reação;
- Dificuldades explícitas;
- alcance;
- frequência de uso.

As características de subclasse preservam também o vínculo com sua subclasse e o estágio de
progressão `foundation`, `specialization` ou `mastery`. Os nomes e textos vêm da tradução
PT-BR, complementada por `lib/compendium/expansion-subclass-features.pt-BR.json` para as
31 características ausentes de Artista Marcial, Cerca-Viva, Executor, Implacável,
Intoxicante e Lunar. Esse complemento traduz o SRD 2.0 e inclui as 16 posturas e as regras
de Foco do Artista Marcial. O pack Foundryborne sincroniza o metadado estrutural do SRD.
Nenhuma arte de subclasse, logo ou outra imagem restrita do Foundryborne é copiada pelo pipeline.

O arquivo gerado fica em `lib/compendium/daggerheart.generated.json`. Ele é commitado para
que builds de produção não dependam dos repositórios externos.

## Ícones de classes e características

As 15 classes e as 42 características usam ícones locais WebP de 256 × 256 pixels,
sem escrita, com cantos arredondados e transparência nos cantos. Os arquivos ficam em
`public/compendium/daggerheart/classes` e `public/compendium/daggerheart/class-features`.
As artes foram geradas para este projeto. Inspiração e Inspiração (Nível 5) têm ícones
distintos; Auxílio dos Espíritos e Invocar Entidade também usam o conjunto local.
O importador preserva esses vínculos nas atualizações do compêndio.

## Ícones de ancestralidades e características

As 24 ancestralidades e as 47 características ancestrais distintas usam ícones locais
WebP de 256 × 256 pixels, sem escrita, com cantos arredondados. Os arquivos ficam em
`public/compendium/daggerheart/ancestries` e `public/compendium/daggerheart/ancestry-features`.
Anfíbio compartilha a mesma arte entre Quacho e Maresial, cobrindo as 48 entradas de
características do compêndio. As artes foram geradas para este projeto e são exibidas
inteiras, sem cortes. O importador preserva os vínculos nas atualizações dos dados.

## Ícones de comunidades e características

As 15 comunidades e as 15 características de comunidade usam ícones locais WebP
de 256 × 256 pixels, sem escrita e com cantos arredondados transparentes, gerados
para este projeto. Os arquivos ficam em `public/compendium/daggerheart/communities`
e `public/compendium/daggerheart/community-features`. As artes são exibidas inteiras,
sem cortes, e o importador preserva os vínculos nas atualizações do compêndio.

## Ícones de subclasses e características

As 31 subclasses e as 117 características distintas do conjunto original usam ícones locais WebP de
256 × 256 pixels, sem escrita e com cantos arredondados transparentes, gerados
para este projeto. Os arquivos ficam em `public/compendium/daggerheart/subclasses`
e `public/compendium/daggerheart/subclass-features`. Regeneração compartilha a mesma
arte entre Protetor da Renovação e Ordem do Licantropo, cobrindo 118 entradas.
As 31 características complementares reutilizam o ícone da própria subclasse quando
não têm arte específica, totalizando 149 entradas com arte. Os ícones são exibidos inteiros no compêndio,
na ficha, na criação e nas características de evolução. O importador preserva
os vínculos nas atualizações dos dados.

## Ícones de domínios

Os 11 domínios têm um ícone compartilhado pelas respectivas cartas: símbolo branco
centralizado sobre fundo colorido com degradê suave. As 210 cartas de dez domínios
preservam os PNGs Foundryborne e sua atribuição. As 21 cartas de Blood usam
`public/compendium/daggerheart/domains/blood.png`, PNG de 500 × 500 pixels criado
para o OracleRPG com geração de imagens: uma gota branca estilizada, com recortes
angulares, sobre fundo vinho/vermelho, sem escrita nem moldura.

Esse arquivo fica fora da pasta regenerada pelo sync Foundryborne. O importador
aplica a arte depois das substituições do Void, cobrindo também suas cartas novas.
O teste de importação verifica que cada domínio tem um único ícone e nenhuma carta
fica sem arte.

## Organização da consulta

Classes, ancestralidades, comunidades e subclasses exibem suas características
logo abaixo da entrada principal, em cartões menores e recuados. As características
de subclasse seguem a ordem Fundação, Especialização e Maestria. As cartas são
agrupadas por domínio e, dentro dele, por nível numérico.

A busca mantém a entrada principal como contexto quando encontra uma de suas
características; ao encontrar a entrada principal, exibe suas características.
A visualização Todos mantém a mesma organização por categoria.

## Atualização dos dados

Equipamentos são agrupados por raridade e incluem os metadados necessários para a
seleção por patamar na criação. Consulte `docs/equipment-rarity-and-creation.md`
para a classificação, os limites e o fluxo dos cartões de equipamento.

Com os repositórios-fonte clonados ao lado do RPGptSWIG, execute primeiro
`npm run sync:foundryborne-subclasses` e depois `npm run import:daggerheart`.

O sync gera `lib/compendium/foundryborne-subclass-features.manifest.json`, que é commitado junto
com o compêndio para que builds de produção não dependam do checkout do Foundryborne.

O importador recusa IDs duplicados, vínculos órfãos, cartas sem domínio/nível válido,
ancestralidades sem duas características, comunidades sem uma característica e subclasses
sem Fundação, Especialização ou Maestria. Os testes também fixam os vínculos
Liberta → Desgarrado e Sem Comunidade → Família Adotada.

A auditoria de cobertura e as diferenças entre versões das fontes estão registradas em
`docs/compendium-audit-2026-10-25.md`.

O importador também copia somente `adversaries/portraits/*.webp`; tokens circulares e
wildcards não são incluídos no app.
