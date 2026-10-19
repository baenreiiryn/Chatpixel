# OracleRPG Android

O APK usa a interface web publicada em `https://oraclerpg.vercel.app`, mas executa o
runtime de Sign in with ChatGPT **dentro do próprio processo Android**.

## ChatGPT

- servidor loopback local: `127.0.0.1:31415`;
- `dynamic_agent_client` no primeiro login;
- OAuth Authorization Code + PKCE no navegador do sistema;
- ID token validado com JWKS da OpenAI;
- credenciais criptografadas pelo Android Keystore;
- tokens nunca são enviados ao Vercel ou Neon;
- `/v1/models` e `/v1/responses` são chamados diretamente pelo aparelho.

## Atualização

Ao iniciar, o app consulta:

`https://api.github.com/repos/baenreiiryn/RPGptSWIG/releases/latest`

Builds de release usam uma faixa de `versionCode` própria (200000+) para que usuários
migrados do repositório antigo continuem recebendo atualizações sem o Android interpretar
os APKs do novo repositório como downgrade.

Se o `tag_name` for mais novo que `BuildConfig.VERSION_NAME`, o usuário recebe um diálogo.
Ao aceitar:

1. o APK do Release é baixado;
2. se necessário, o Android pede autorização para instalar apps desta fonte;
3. o instalador do sistema é aberto para confirmar a atualização.

Todos os releases precisam usar a mesma chave de assinatura. **Enquanto o APK está em fase
de teste**, o repositório contém uma chave de desenvolvimento pública em
`.github/oraclerpg-test.jks.b64`. Ela existe apenas para permitir instalar um build de teste
por cima do anterior.

Antes de distribuir o OracleRPG como release definitivo, essa chave deve ser substituída por
uma chave privada de produção guardada em GitHub Secrets. A troca de assinatura exigirá
desinstalar uma vez os APKs de teste.

## Release

Crie uma tag:

```bash
git tag v0.2.1
git push origin v0.2.1
```

O GitHub Actions compila, assina, cria o Release e publica o APK + SHA-256.
