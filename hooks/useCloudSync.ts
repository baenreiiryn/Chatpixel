"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import type { GameState } from "@/lib/game";

const CLOUD_KEY = "oraclerpg:cloud:v1";
const RECOVERY_KEY = "oraclerpg:cloud-recovery:v1";

type Credentials = {
  campaignId: string;
  syncKey: string;
  version: number;
  lastSyncedHash?: string;
};
type Conflict = {
  state: GameState;
  version: number;
  updatedAt?: string;
  reason: "both_changed" | "remote_older";
} | null;
type Recovery = {
  state: GameState;
  campaignId: string;
  savedAt: string;
} | null;

export type CloudState = "local" | "connecting" | "synced" | "syncing" | "offline" | "conflict" | "error";

function parsePairCode(code: string) {
  const split = code.trim().split(".");
  if (split.length !== 2 || !split[0] || !split[1]) return null;
  return { campaignId: split[0], syncKey: split[1], version: 0 };
}

function fingerprint(serialized: string) {
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function useCloudSync(
  state: GameState,
  setState: Dispatch<SetStateAction<GameState>>,
  ready: boolean,
) {
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [status, setStatus] = useState<CloudState>("local");
  const [conflict, setConflict] = useState<Conflict>(null);
  const [recovery, setRecovery] = useState<Recovery>(null);
  const lastSynced = useRef<string>("");
  const credentialsRef = useRef<Credentials | null>(null);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const saveCredentials = useCallback((next: Credentials | null) => {
    credentialsRef.current = next;
    setCredentials(next);
    if (next) localStorage.setItem(CLOUD_KEY, JSON.stringify(next));
    else localStorage.removeItem(CLOUD_KEY);
  }, []);

  const saveRecovery = useCallback((next: Exclude<Recovery, null>) => {
    setRecovery(next);
    try {
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(next));
    } catch {
      // The active local state remains untouched even if the browser storage
      // quota is too small for an additional recovery snapshot.
    }
  }, []);

  const clearRecovery = useCallback(() => {
    setRecovery(null);
    localStorage.removeItem(RECOVERY_KEY);
  }, []);

  const fetchRemote = useCallback(async (creds: Credentials, forceApply = false) => {
    setStatus("connecting");
    try {
      const response = await fetch(`/api/campaigns/${creds.campaignId}`, {
        headers: { authorization: `Bearer ${creds.syncKey}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not open cloud campaign.");
      const data = (await response.json()) as { state: GameState; version: number; updatedAt?: string };
      const remoteSerialized = JSON.stringify(data.state);
      const localSerialized = JSON.stringify(stateRef.current);
      const remoteHash = fingerprint(remoteSerialized);
      const localHash = fingerprint(localSerialized);

      const acceptRemote = () => {
        saveCredentials({
          ...creds,
          version: data.version,
          lastSyncedHash: remoteHash,
        });
        lastSynced.current = remoteSerialized;
        setState(data.state);
        setConflict(null);
        setStatus("synced");
      };

      if (forceApply || localHash === remoteHash) {
        acceptRemote();
        return data;
      }

      // The server is still on the exact version this device last knew about.
      // Therefore the differing local state is newer/unsynced and must win.
      if (data.version === creds.version) {
        saveCredentials({
          ...creds,
          version: data.version,
          lastSyncedHash: remoteHash,
        });
        lastSynced.current = remoteSerialized;
        setConflict(null);
        setStatus("synced");
        return data;
      }

      // If the remote advanced while our local state also diverged from the
      // last known synced snapshot, preserve both and ask the user.
      if (data.version > creds.version) {
        const localWasUnchanged = Boolean(creds.lastSyncedHash && localHash === creds.lastSyncedHash);
        if (localWasUnchanged) {
          acceptRemote();
          return data;
        }
        setConflict({
          state: data.state,
          version: data.version,
          updatedAt: data.updatedAt,
          reason: "both_changed",
        });
        setStatus("conflict");
        return data;
      }

      // A remote version lower than the one already recorded locally should
      // never silently replace the device state.
      setConflict({
        state: data.state,
        version: data.version,
        updatedAt: data.updatedAt,
        reason: "remote_older",
      });
      setStatus("conflict");
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
      const savedRecovery = localStorage.getItem(RECOVERY_KEY);
      if (savedRecovery) {
        try {
          setRecovery(JSON.parse(savedRecovery) as Exclude<Recovery, null>);
        } catch {
          localStorage.removeItem(RECOVERY_KEY);
        }
      }
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
    const serialized = JSON.stringify(state);
    const creds = {
      campaignId: data.id,
      syncKey: data.syncKey,
      version: data.version,
      lastSyncedHash: fingerprint(serialized),
    };
    saveCredentials(creds);
    lastSynced.current = serialized;
    setStatus("synced");
    return creds;
  }, [saveCredentials, state]);

  const joinCloud = useCallback(async (code: string) => {
    const creds = parsePairCode(code);
    if (!creds) throw new Error("Código de pareamento inválido.");
    saveCredentials(creds);
    const result = await fetchRemote(creds, true);
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
          const data = (await response.json()) as { state: GameState; version: number; updatedAt?: string };
          setConflict({
            state: data.state,
            version: data.version,
            updatedAt: data.updatedAt,
            reason: data.version < active.version ? "remote_older" : "both_changed",
          });
          setStatus("conflict");
          return;
        }
        if (!response.ok) throw new Error();
        const data = (await response.json()) as { version: number };
        saveCredentials({
          ...active,
          version: data.version,
          lastSyncedHash: fingerprint(serialized),
        });
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
      saveRecovery({
        state: stateRef.current,
        campaignId: active.campaignId,
        savedAt: new Date().toISOString(),
      });
      const serialized = JSON.stringify(conflict.state);
      const next = {
        ...active,
        version: conflict.version,
        lastSyncedHash: fingerprint(serialized),
      };
      saveCredentials(next);
      lastSynced.current = serialized;
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
    if (response.status === 409) {
      const data = (await response.json()) as { state: GameState; version: number; updatedAt?: string };
      setConflict({
        state: data.state,
        version: data.version,
        updatedAt: data.updatedAt,
        reason: data.version < active.version ? "remote_older" : "both_changed",
      });
      setStatus("conflict");
      return;
    }
    if (!response.ok) {
      setStatus("error");
      return;
    }
    const data = (await response.json()) as { version: number };
    const serialized = JSON.stringify(state);
    saveCredentials({
      ...active,
      version: data.version,
      lastSyncedHash: fingerprint(serialized),
    });
    lastSynced.current = serialized;
    setConflict(null);
    setStatus("synced");
  }, [conflict, saveCredentials, saveRecovery, setState, state]);

  const restoreRecovery = useCallback(() => {
    if (!recovery) return;
    setState(recovery.state);
    clearRecovery();
    setConflict(null);
    setStatus(credentialsRef.current ? "synced" : "local");
  }, [clearRecovery, recovery, setState]);

  return {
    credentials,
    status,
    conflict,
    recovery,
    pairCode: credentials ? `${credentials.campaignId}.${credentials.syncKey}` : "",
    createCloud,
    joinCloud,
    disconnectCloud,
    fetchRemote: () => credentials && fetchRemote(credentials),
    resolveConflict,
    restoreRecovery,
  };
}

