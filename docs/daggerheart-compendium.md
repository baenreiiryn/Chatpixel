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
progressão `foundation`, `specialization` ou `mastery`. Os nomes e textos continuam vindo da
tradução PT-BR; o pack Foundryborne é usado apenas para sincronizar esse metadado estrutural do
SRD. Nenhuma arte de subclasse, logo ou outra imagem restrita do Foundryborne é copiada pelo
pipeline.

O arquivo gerado fica em `lib/compendium/daggerheart.generated.json`. Ele é commitado para
que builds de produção não dependam dos repositórios externos.

## Atualização dos dados

Com os repositórios-fonte clonados ao lado do RPGptSWIG, execute primeiro
`npm run sync:foundryborne-subclasses` e depois `npm run import:daggerheart`.

O sync gera `lib/compendium/foundryborne-subclass-features.manifest.json`, que é commitado junto
com o compêndio para que builds de produção não dependam do checkout do Foundryborne.

O importador também copia somente `adversaries/portraits/*.webp`; tokens circulares e
wildcards não são incluídos no app.
