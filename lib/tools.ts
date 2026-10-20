export type OracleTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export const oracleTools: OracleTool[] = [
  {
    name: "request_player_roll",
    description: "Solicita uma rolagem ao jogador e pausa a resolução da cena até o resultado ser fornecido ao OracleRPG.",
    inputSchema: {
      type: "object",
      properties: {
        label: { type: "string", minLength: 1 },
        reason: { type: "string", minLength: 1 },
        formula: {
          type: "string",
          minLength: 1,
          description: "Fórmula de dados válida, por exemplo 1d20+2 ou 2d12. Em rolagens de Dualidade, inclua exatamente 2d12 positivos para Esperança e Medo; dados auxiliares e modificadores podem ser adicionados."
        },
        allowedDice: {
          type: "array",
          items: { type: "string", enum: ["d2", "d4", "d6", "d8", "d10", "d12", "d20", "d100"] },
          minItems: 1,
          uniqueItems: true,
          description: "Tipos de dado permitidos quando o jogador pode montar a própria rolagem."
        },
        target: { type: "number", description: "Valor-alvo ou CD, quando conhecido." },
        dc: { type: "number", description: "Alias de target para uma Classe de Dificuldade." },
        rollKind: {
          type: "string",
          enum: ["attack", "damage", "reaction", "check", "duality", "custom"],
          description: "Tipo da rolagem. duality exige formula com exatamente dois d12 positivos."
        }
      },
      required: ["label", "reason"],
      anyOf: [
        { required: ["formula"] },
        { required: ["allowedDice"] }
      ],
      additionalProperties: false
    }
  },
  {
    name: "character_adjust_resource",
    description: "Ajusta um recurso mecânico do personagem usando o command bus do OracleRPG.",
    inputSchema: {
      type: "object",
      properties: {
        resource: { type: "string", enum: ["hp", "hope", "stress", "armor"] },
        amount: { type: "integer" },
        reason: { type: "string" }
      },
      required: ["resource", "amount", "reason"],
      additionalProperties: false
    }
  },
  {
    name: "inventory_adjust",
    description: "Adiciona ou consome quantidade de um item conhecido.",
    inputSchema: {
      type: "object",
      properties: {
        itemId: { type: "string" },
        amount: { type: "integer" },
        reason: { type: "string" }
      },
      required: ["itemId", "amount", "reason"],
      additionalProperties: false
    }
  },
  {
    name: "quest_add",
    description: "Registra uma nova missão aceita pelo grupo. Se houver prazo, também cria automaticamente o prazo correspondente no calendário.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        stage: { type: "string" },
        deadlineMinutes: { type: "integer", minimum: 1 },
        deadlineDescription: { type: "string" }
      },
      required: ["title", "stage"],
      additionalProperties: false
    }
  },
  {
    name: "quest_set_status",
    description: "Atualiza o estado de uma missão conhecida.",
    inputSchema: {
      type: "object",
      properties: {
        questId: { type: "string" },
        status: { type: "string", enum: ["active", "completed"] },
        reason: { type: "string" }
      },
      required: ["questId", "status", "reason"],
      additionalProperties: false
    }
  },
  {
    name: "condition_set",
    description: "Aplica ou remove uma condição do personagem.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        active: { type: "boolean" },
        reason: { type: "string" }
      },
      required: ["name", "active", "reason"],
      additionalProperties: false
    }
  },
  {
    name: "advance_time",
    description: "Avança o relógio da campanha pelo número de minutos transcorridos na ficção.",
    inputSchema: {
      type: "object",
      properties: {
        minutes: { type: "integer", minimum: 1 },
        reason: { type: "string" }
      },
      required: ["minutes"],
      additionalProperties: false
    }
  },
  {
    name: "set_weather",
    description: "Atualiza o clima atual persistido da campanha quando a narração estabelecer uma nova condição.",
    inputSchema: {
      type: "object",
      properties: {
        condition: {
          type: "string",
          enum: ["clear", "partly-cloudy", "cloudy", "rain", "storm", "snow", "fog", "wind", "custom"]
        },
        label: { type: "string" },
        description: { type: "string" },
        temperatureC: { type: "number" },
        intensity: { type: "string", enum: ["light", "moderate", "heavy"] }
      },
      required: ["condition", "label"],
      additionalProperties: false
    }
  },
  {
    name: "calendar_event_add",
    description: "Adiciona ao calendário um prazo, efeito temporário, compromisso ou acontecimento futuro. Pode usar minutos absolutos da campanha ou tempos relativos ao momento atual.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        startCampaignMinute: { type: "integer", minimum: 0 },
        startsInMinutes: { type: "integer", minimum: 0 },
        endCampaignMinute: { type: "integer", minimum: 0 },
        durationMinutes: { type: "integer", minimum: 1 },
        kind: { type: "string", enum: ["quest", "effect", "appointment", "world", "custom"] },
        sourceId: { type: "string" },
        description: { type: "string" },
        completed: { type: "boolean" }
      },
      required: ["title"],
      additionalProperties: false
    }
  },
  {
    name: "calendar_event_update",
    description: "Atualiza um evento de calendário já conhecido, inclusive prazo, duração ou conclusão.",
    inputSchema: {
      type: "object",
      properties: {
        eventId: { type: "string" },
        title: { type: "string" },
        startCampaignMinute: { type: "integer", minimum: 0 },
        endCampaignMinute: { type: "integer", minimum: 0 },
        kind: { type: "string", enum: ["quest", "effect", "appointment", "world", "custom"] },
        sourceId: { type: "string" },
        description: { type: "string" },
        completed: { type: "boolean" }
      },
      required: ["eventId"],
      additionalProperties: false
    }
  },
  {
    name: "calendar_event_remove",
    description: "Remove um evento persistido do calendário da campanha.",
    inputSchema: {
      type: "object",
      properties: {
        eventId: { type: "string" }
      },
      required: ["eventId"],
      additionalProperties: false
    }
  },
  {
    name: "memory_search",
    description: "Busca fatos, eventos e segredos relevantes da campanha persistida no OracleRPG.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 20 }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "memory_record",
    description: "Registra uma nova memória persistente da campanha.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["fact", "event", "secret", "visual"] },
        text: { type: "string" }
      },
      required: ["kind", "text"],
      additionalProperties: false
    }
  }
];
