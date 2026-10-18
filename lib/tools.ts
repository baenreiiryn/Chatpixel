export type OracleTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export const oracleTools: OracleTool[] = [
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
        kind: { type: "string", enum: ["fact", "event", "secret"] },
        text: { type: "string" }
      },
      required: ["kind", "text"],
      additionalProperties: false
    }
  }
];
