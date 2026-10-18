"use client";

import { useCallback, useEffect, useState } from "react";

const BRIDGE_URL = "http://127.0.0.1:31415";

export type BridgeModel = { slug: string; displayName: string };
export type BridgeAccount = {
  email: string | null;
  name: string | null;
  clientId: string | null;
  scopes: string[];
  connected: boolean;
};

export type BridgeStatus = "checking" | "missing" | "ready" | "connecting" | "error";

export function useOracleBridge() {
  const [status, setStatus] = useState<BridgeStatus>("checking");
  const [account, setAccount] = useState<BridgeAccount | null>(null);
  const [models, setModels] = useState<BridgeModel[]>([]);
  const [model, setModel] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`${BRIDGE_URL}/health`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setAccount(data.account || null);
      setStatus("ready");
      setError("");
      if (data.account?.connected) {
        try {
          const modelResponse = await fetch(`${BRIDGE_URL}/models`, { cache: "no-store" });
          if (modelResponse.ok) {
            const modelData = await modelResponse.json();
            const nextModels = modelData.models || [];
            setModels(nextModels);
            setModel((current) => current || nextModels[0]?.slug || "");
          }
        } catch {}
      } else {
        setModels([]);
        setModel("");
      }
    } catch {
      setAccount(null);
      setModels([]);
      setStatus("missing");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError("");
    try {
      const response = await fetch(`${BRIDGE_URL}/auth/start`, { method: "POST" });
      if (!response.ok) throw new Error("Não foi possível iniciar o login.");
      window.setTimeout(() => void refresh(), 1500);
    } catch (cause) {
      setStatus("missing");
      setError(cause instanceof Error ? cause.message : "Oracle Bridge indisponível.");
    }
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await fetch(`${BRIDGE_URL}/auth/logout`, { method: "POST" });
    } finally {
      await refresh();
    }
  }, [refresh]);

  const respond = useCallback(async (payload: {
    model: string;
    instructions: string;
    input: unknown[];
    tools?: unknown[];
  }) => {
    const response = await fetch(`${BRIDGE_URL}/responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.error || "Falha no Mestre IA.");
      (err as Error & { code?: string }).code = data.code;
      throw err;
    }
    return data.response;
  }, []);

  return { status, account, models, model, setModel, error, refresh, connect, logout, respond };
}
