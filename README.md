# Chatpixel + OracleRPG

Cópia de `baenreiiryn/RPGptSWIG`, commit `f75846285bd14a55b06ff1d34e0cd22573aa0b96`, com o Chatpixel 0.5.2 integrado no painel visual da Sessão. O OracleRPG original não é modificado. O protótipo independente foi preservado em `prototype/` com seu histórico no repositório.

## Funcionamento

O chat da sessão controla a cena pelo mesmo Sign in with ChatGPT e pela ferramenta `scene_render`. Não há outro mestre, campo de comando ou login no painel. A ficha OracleRPG continua sendo a fonte das regras, inventário, HP e dados. O visual usa somente categorias de armas possuídas; outras armas corpo a corpo usam a animação aproximada de espada. A aparência modular, presença por encontro e composição do cenário são validadas antes de alterar o estado visual.

Cada campanha persiste sua cena e NPCs visíveis junto com ficha e mensagens. O cadastro global de NPCs e as memórias não implicam presença física. A troca de encontro preserva a transição parallax; falhas no Canvas não bloqueiam o chat. Retomar uma resposta usa os checkpoints do mestre para não repetir animações já aplicadas.

## Executar

`npm ci`, `npm run bridge` e `npm run dev`. O bridge desta cópia usa `127.0.0.1:31417` e dados próprios em `.chatpixel-oracle`, separados do OracleRPG original. A aplicação web mantém as rotas opcionais de sincronização, configuradas por `.env.example`.

## Android

`npm run build:android` gera a interface estática em `out/`; as rotas de nuvem ficam temporariamente fora da exportação e são restauradas ao terminar. O Gradle inclui `out/` no APK. O aplicativo serve interface e bridge no próprio aparelho em `127.0.0.1:31417`, com login no navegador. Usa `com.baenreiiryn.chatpixel` para atualizar o Chatpixel existente sem substituir o OracleRPG original. Campanhas locais do outro aplicativo não são copiadas automaticamente; use os recursos de importação/exportação da campanha. A campanha funciona localmente; ao ativar a sincronização por código, o bridge Android encaminha somente as rotas de campanha ao backend original em `oraclerpg-swig.vercel.app`. Assim é possível usar o código de uma campanha existente. As credenciais ChatGPT nunca são encaminhadas a esse backend.

## Verificar

- `npm test`: testes de regras, sessão, dados, memória e integração Chatpixel. Os testes do importador usam os repositórios `etiagoabreu/daggerheart-translation-pt-BR` e `Foundryborne/daggerheart` em pastas irmãs (este último apenas `src/packs/domains`).
- `npm run test:pixel`: testes do protótipo preservado.
- `npm run lint`: TypeScript.
- `npm run build:android`: exportação e compilação da interface.
- `node scripts/verify-integrated-ui.mjs`: chat → bridge simulado → ferramenta → painel, persistência, presença de NPCs, inventário/HP, desktop e celular. Requer Chromium do Playwright. Não valida a conta ChatGPT real.

O workflow compila e assina o APK com a chave de teste existente do Chatpixel. Confira `THIRD_PARTY_NOTICES.md` para os créditos dos materiais do compêndio copiados da base OracleRPG.
