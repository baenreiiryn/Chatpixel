# Chatpixel — laboratório de corpos modulares

Abra index.html no navegador. É autocontido e funciona offline, inclusive sem servidor.

64 peças PNG com transparência recortadas das três pranchas aprovadas. Nove famílias de rig e três escalas proporcionais, total de 27 combinações. As 64 peças são compartilhadas, não 27 conjuntos independentes. As posições e os pivôs normalizados estão em rigs.json; rig-player.js contém as animações procedurais de repouso, caminhada, ataque genérico e voo.

Esta é uma oficina para testar a montagem, não uma substituição dos personagens do app nem uma versão APK. O ataque é visual e não resolve mecânicas. Asas e caudas acompanham o corpo. Espelhamento muda o sentido horizontal, não cria as oito vistas do ZIP de referência.

As peças não são sprites nativos exatos de 32/48/72 px: esses valores são unidades lógicas aproximadas do humanoide. A anatomia define a largura e altura das demais famílias. Algumas extremidades do desenho original estavam encostadas; os recortes foram isolados por caixa e componente alfa. Retoques e poses específicas podem melhorar as junções.

## Formato
Cada nó: id, part, parent, x/y relativos ao pivô do pai, w/h lógicos, pivot normalizado, angle em graus, motion e phase. A ordem no array determina a sobreposição; parent determina a hierarquia, independentemente da ordem. Peças distantes são desenhadas primeiro.

## Verificação
node test.mjs verifica hierarquia, todas as poses e tamanhos e executa a prévia no Chromium quando Playwright está disponível.
