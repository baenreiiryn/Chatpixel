# Artes dos equipamentos

O conjunto contém 368 arquivos WebP 256×256 com cantos transparentes:
204 armas, 35 armaduras, 61 consumíveis, 65 itens de saque e 3 bônus
(Tocha, Corda e Suprimentos básicos).

Os arquivos ficam em `public/compendium/daggerheart/equipment`.
O manifesto `lib/compendium/equipment-art.manifest.json` registra ID, nome,
tipo, caminho e SHA-256 de cada arte. A importação associa as 365 entradas
por ID e valida a identidade e a existência dos arquivos.

A criação do personagem preserva a arte no inventário. A interface também
resolve os itens antigos por ID, sourceId ou nome sem ambiguidade. Nomes
traduzidos compartilhados por variantes não escolhem uma arte aleatória.
Itens personalizados mantêm sua arte e os ícones genéricos continuam
disponíveis quando não existe correspondência.
