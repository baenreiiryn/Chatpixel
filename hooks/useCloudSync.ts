"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import type { GameState } from "@/lib/game";

const CLOUD_KEY = "oraclerpg:cloud:v1";

type Credentials = { campaignId: string; syncKey: string; version: number };
type Conflict = { state: GameState; version: number } | null;

export type CloudState = "local" | "connecting" | "synced" | "syncing" | "offline" | "conflict" | "error";

function parsePairCode(code: string) {
  const split = code.trim().split(".");
  if (split.length !== 2 || !split[0] || !split[1]) return null;
  return { campaignId: split[0], syncKey: split[1], version: 0 };
}

export function useCloudSync(
  state: GameState,
  setState: Dispatch<SetStateAction<GameState>>,
  ready: boolean,
) {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [status, setStatus] = useState<CloudState>("local");
  const [conflict, setConflict] = useState<Conflict>(null);
  const lastSynced = useRef<string>("");
  const credentialsRef = useRef<Credentials | null>(null);

  const saveCredentials = useCallback((next: Credentials | null) => {
    credentialsRef.current = next;
    setCredentials(next);
    if (next) localStorage.setItem(CLOUD_KEY, JSON.stringify(next));
    else localStorage.removeItem(CLOUD_KEY);
  }, []);

  const fetchRemote = useCallback(async (creds: Credentials, apply = true) => {
    setStatus("connecting");
    try {
      const response = await fetch(`/api/campaigns/${creds.campaignId}`, {
        headers: { authorization: `Bearer ${creds.syncKey}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not open cloud campaign.");
      const data = (await response.json()) as { state: GameState; version: number };
      const next = { ...creds, version: data.version };
      saveCredentials(next);
      lastSynced.current = JSON.stringify(data.state);
      if (apply) setState(data.state);
      setConflict(null);
      setStatus("synced");
      return data;
    } catch {
      setStatus(navigator.onLine ? "error" : "offline");
      return null;
    }
  }, [saveCredentials, setState]);

  useEffect(() => {
    if (!ready) return;
    try {
      const saved = localStorage.getItem(CLOUD_KEY);
      if (!saved) return;
      const creds = JSON.parse(saved) as Credentials;
      saveCredentials(creds);
      void fetchRemote(creds);
    } catch {
      localStorage.removeItem(CLOUD_KEY);
    }
  }, [ready, fetchRemote, saveCredentials]);

  const createCloud = useCallback(async () => {
    setStatus("connecting");
    const response = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ state }),
    });
    if (!response.ok) {
      setStatus("error");
      throw new Error("Could not create cloud campaign.");
    }
    const data = (await response.json()) as { id: string; syncKey: string; version: number };
    const creds = { campaignId: data.id, syncKey: data.syncKey, version: data.version };
    saveCredentials(creds);
    lastSynced.current = JSON.stringify(state);
    setStatus("synced");
    return creds;
  }, [saveCredentials, state]);

  const joinCloud = useCallback(async (code: string) => {
    const creds = parsePairCode(code);
    if (!creds) throw new Error("Código de pareamento inválido.");
    saveCredentials(creds);
    const result = await fetchRemote(creds);
    if (!result) throw new Error("Não foi possível abrir essa campanha.");
    return result;
  }, [fetchRemote, saveCredentials]);

  const disconnectCloud = useCallback(() => {
    saveCredentials(null);
    lastSynced.current = "";
    setConflict(null);
    setStatus("local");
  }, [saveCredentials]);

  useEffect(() => {
    if (!ready || !credentials || !lastSynced.current || status === "connecting" || status === "conflict") return;
    const serialized = JSON.stringify(state);
    if (serialized === lastSynced.current) return;
    const timer = window.setTimeout(async () => {
      const active = credentialsRef.current;
      if (!active) return;
      setStatus("syncing");
      try {
        const response = await fetch(`/api/campaigns/${active.campaignId}`, {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${active.syncKey}`,
          },
          body: JSON.stringify({ state, expectedVersion: active.version }),
        });
        if (response.status === 409) {
          const data = (await response.json()) as { state: GameState; version: number };
          setConflict({ state: data.state, version: data.version });
          setStatus("conflict");
          return;
        }
        if (!response.ok) throw new Error();
        const data = (await response.json()) as { version: number };
        saveCredentials({ ...active, version: data.version });
        lastSynced.current = serialized;
        setStatus("synced");
      } catch {
        setStatus(navigator.onLine ? "error" : "offline");
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [credentials, ready, saveCredentials, state, status]);

  const resolveConflict = useCallback(async (choice: "remote" | "local") => {
    const active = credentialsRef.current;
    if (!active || !conflict) return;
    if (choice === "remote") {
      const next = { ...active, version: conflict.version };
      saveCredentials(next);
      lastSynced.current = JSON.stringify(conflict.state);
      setState(conflict.state);
      setConflict(null);
      setStatus("synced");
      return;
    }

    setStatus("syncing");
    const response = await fetch(`/api/campaigns/${active.campaignId}`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${active.syncKey}`,
      },
      body: JSON.stringify({ state, expectedVersion: conflict.version }),
    });
    if (!response.ok) {
      setStatus("error");
      return;
    }
    const data = (await response.json()) as { version: number };
    saveCredentials({ ...active, version: data.version });
    lastSynced.current = JSON.stringify(state);
    setConflict(null);
    setStatus("synced");
  }, [conflict, saveCredentials, setState, state]);

  return {
    credentials,
    status,
    conflict,
    pairCode: credentials ? `${credentials.campaignId}.${credentials.syncKey}` : "",
    createCloud,
    joinCloud,
    disconnectCloud,
    fetchRemote: () => credentials && fetchRemote(credentials),
    resolveConflict,
  };
}

