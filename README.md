# OracleRPG

OracleRPG é uma interface persistente para campanhas em que o ChatGPT atua como Mestre.

## Princípio

- O **OracleRPG é a fonte da verdade**: ficha, recursos, NPCs, missões, memória e histórico de eventos.
- O **ChatGPT é o Mestre**: recebe apenas o contexto relevante, narra e chama ferramentas.
- Alterações manuais e alterações da IA passam pelo mesmo command bus.
- A campanha não depende da duração de uma conversa: o contexto pode ser reconstruído a qualquer turno.

## MVP atual

- UI mobile-first responsiva.
- Campanha demonstrativa em Daggerheart.
- PV, Esperança, Estresse e Armadura editáveis.
- Inventário editável.
- Condições, NPCs e missões.
- Memória persistente e prévia do pacote de contexto.
- Log de alterações com Undo.
- Persistência em `localStorage`.
- Tela preparada para Sign in with ChatGPT.

## Rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Próximas camadas

1. Banco remoto (campanhas, entidades, eventos, memórias).
2. Conta do usuário.
3. Sign in with ChatGPT / plan sharing quando o app tiver acesso.
4. Tool schema do Mestre apontando para o command bus.
5. Recuperação semântica de memória por campanha.
6. Regras por sistema (Daggerheart, D&D, Cyberpunk etc.).
