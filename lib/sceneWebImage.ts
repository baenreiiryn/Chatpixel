export type SceneWebImage = {
  scene: string;
  query: string;
  imageUrl: string;
  thumbnailUrl?: string;
  sourceUrl: string;
  caption?: string;
  searchedAt: string;
};

export type SceneWebImageErrorInfo = {
  category: "no-results" | "permission" | "rate-limit" | "network" | "api" | "unknown";
  title: string;
  detail: string;
};

function compactErrorMessage(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function describeSceneWebImageError(message: string): SceneWebImageErrorInfo {
  const detail = compactErrorMessage(message).slice(0, 280);
  if (/não retornou uma imagem utilizável/i.test(detail)) {
    return {
      category: "no-results",
      title: "A busca terminou sem uma imagem utilizável.",
      detail,
    };
  }

  const status = detail.match(/(?:failed|falhou).*?\((\d{3})\)|\bHTTP\s*(\d{3})\b/i);
  const code = Number(status?.[1] || status?.[2] || 0);
  if (code === 401 || code === 403) {
    return {
      category: "permission",
      title: "O Web Search não foi autorizado para esta conta/modelo.",
      detail,
    };
  }
  if (code === 429) {
    return {
      category: "rate-limit",
      title: "O limite temporário de uso da busca foi atingido.",
      detail,
    };
  }
  if (code >= 400) {
    return {
      category: "api",
      title: `A API rejeitou a busca de imagem (HTTP ${code}).`,
      detail,
    };
  }
  if (/network|failed to fetch|timeout|timed out|socket|connection|offline/i.test(detail)) {
    return {
      category: "network",
      title: "A busca falhou por conexão ou timeout.",
      detail,
    };
  }
  return {
    category: "unknown",
    title: "A busca de imagem falhou antes de retornar um resultado.",
    detail: detail || "Erro sem detalhes retornados pelo bridge.",
  };
}

type WebImageResult = {
  type?: unknown;
  image_url?: unknown;
  thumbnail_url?: unknown;
  source_website_url?: unknown;
  caption?: unknown;
};

function httpsUrl(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export function buildSceneWebImageSearchPrompt({
  scene,
  narration,
  tone,
}: {
  scene: string;
  narration?: string;
  tone?: string;
}) {
  return [
    "Busque imagens existentes na web para representar visualmente o LOCAL desta cena de RPG.",
    "Escolha referências de ambiente, arquitetura, paisagem ou interior; não procure personagens específicos do jogador.",
    "Prefira uma imagem horizontal/cinematográfica adequada a um painel largo e que combine com a atmosfera descrita.",
    "Evite imagens com texto grande, interfaces ou marcas d'água evidentes quando houver alternativa.",
    `Cena/local atual: ${scene}`,
    tone?.trim() ? `Tom da campanha: ${tone.trim()}` : "",
    narration?.trim() ? `Narração recente: ${narration.trim().slice(0, 1600)}` : "",
  ].filter(Boolean).join("\n");
}

export function extractSceneWebImage(
  response: unknown,
  scene: string,
  query: string,
  searchedAt = new Date().toISOString(),
): SceneWebImage | null {
  if (!response || typeof response !== "object") return null;
  const output = Array.isArray((response as { output?: unknown[] }).output)
    ? (response as { output: unknown[] }).output
    : [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const record = item as { type?: unknown; results?: unknown[] };
    if (record.type !== "web_search_call" || !Array.isArray(record.results)) continue;
    for (const raw of record.results) {
      if (!raw || typeof raw !== "object") continue;
      const result = raw as WebImageResult;
      if (result.type !== "image_result") continue;
      const imageUrl = httpsUrl(result.image_url);
      const sourceUrl = httpsUrl(result.source_website_url);
      if (!imageUrl || !sourceUrl) continue;
      const thumbnailUrl = httpsUrl(result.thumbnail_url);
      const caption = typeof result.caption === "string" ? result.caption.trim().slice(0, 300) : "";
      return {
        scene,
        query,
        imageUrl,
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
        sourceUrl,
        ...(caption ? { caption } : {}),
        searchedAt,
      };
    }
  }
  return null;
}
