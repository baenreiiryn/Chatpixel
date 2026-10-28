# Auditoria do compêndio — 25/10/2026

## Correções

- Liberta (`Freeborne`) recebe Desgarrado (`Unbound`).
- Sem Comunidade (`Reborne`) recebe Família Adotada (`Found Family`).
- A tradução-fonte trazia seis subclasses sem características. O complemento PT-BR
  baseado no [SRD 2.0](https://www.daggerheart.com/wp-content/uploads/2026/08/DH_SRD_2_2026_08_25.pdf)
  acrescenta 31 entradas, preservando custos, dados, venenos e fases lunares.
- Artista Marcial inclui as 16 posturas por patamar e as regras de Foco na referência
  Combatente de Posturas. O contador de Foco aparece na ficha, inclusive ao carregar
  personagens com o nome da subclasse em português, e preserva o valor já salvo.

| Subclasse | Fundação | Especialização | Maestria | Total |
| --- | ---: | ---: | ---: | ---: |
| Artista Marcial | 1 | 2 | 2 | 5 |
| Cerca-Viva | 2 | 2 | 1 | 5 |
| Executor | 2 | 2 | 2 | 6 |
| Implacável | 2 | 2 | 2 | 6 |
| Intoxicante | 1 | 2 | 2 | 5 |
| Lunar | 1 | 2 | 1 | 4 |

As novas características reutilizam a arte local de sua subclasse quando ainda não
existe um ícone específico para elas.

## Cobertura conferida

| Família | Entradas principais | Características |
| --- | ---: | ---: |
| Classes | 15 | 42 |
| Ancestralidades | 24 | 48 |
| Comunidades | 15 | 15 |
| Subclasses | 31 | 149 |

Todos os vínculos apontam para entradas existentes. Todas as subclasses têm os três
estágios. Os 11 domínios contêm 231 cartas com domínio e nível de 1 a 10. Não foram
encontrados outros vínculos invertidos no cruzamento com as fontes importadas.

O teste antigo de equipamentos esperava 359 entradas, mas o arquivo já commitado e a
fonte atual têm 365: 204 armas, 35 armaduras, 61 consumíveis e 65 itens de saque.
A expectativa foi atualizada sem acrescentar ou remover equipamentos.

## Diferenças de versão identificadas

O catálogo combina a tradução existente, conteúdo de expansão e Void 1.5. A auditoria
de cobertura não representa uma migração integral de todas essas regras para SRD 2.0.

| Entrada | Catálogo atual | Fonte mais recente conferida |
| --- | --- | --- |
| Angelis (`Aetheris`) | Divine Countenance + Hallowed Aura | Hallowed Aura + Celestial Wings |
| Gnomo (`Gnome`) | Nimble Fingers + True Sight | Nimble Fingers + Flicker Step |
| Ocultista (`Warlock`) e seus pactos | Nomes e textos da tradução/versão anterior | Metadados atuais usam nomes diferentes, como Patron's Pact e Deathless Embrace |

Essas entradas conservam a versão já adotada pelo projeto. Substituí-las isoladamente
poderia misturar versões ou duplicar características; uma atualização de regras precisa
considerar também textos, referências, ícones e personagens existentes.
