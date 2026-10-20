import type { GameState } from "@/lib/game";

export const LEGACY_CAMPAIGN_STORAGE_KEY = "oraclerpg:campaign:v1";
export const CAMPAIGN_LIBRARY_KEY = "oraclerpg:campaign-library:v1";
export const ACTIVE_CAMPAIGN_KEY = "oraclerpg:active-campaign:v1";

export type CampaignLibraryEntry = {
  id: string;
  state: GameState;
  createdAt: string;
  updatedAt: string;
};

export type CampaignLibrary = {
  version: 1;
  campaigns: CampaignLibraryEntry[];
};

export function campaignActivityAt(state: GameState) {
  const values = [
    ...state.messages.map((entry) => entry.createdAt),
    ...state.memories.map((entry) => entry.createdAt),
    ...state.events.map((entry) => entry.createdAt),
    ...(state.timeline ?? []).map((entry) => entry.createdAt),
  ]
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));
  return values.length ? new Date(Math.max(...values)).toISOString() : new Date().toISOString();
}

export function readCampaignLibrary(): CampaignLibraryEntry[] {
  const raw = localStorage.getItem(CAMPAIGN_LIBRARY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CampaignLibrary;
    if (parsed?.version !== 1 || !Array.isArray(parsed.campaigns)) return [];
    return parsed.campaigns.filter((entry) => entry?.id && entry?.state?.campaign);
  } catch {
    return [];
  }
}

export function writeCampaignLibrary(campaigns: CampaignLibraryEntry[]) {
  localStorage.setItem(
    CAMPAIGN_LIBRARY_KEY,
    JSON.stringify({ version: 1, campaigns } satisfies CampaignLibrary),
  );
}

export function migrateLegacyCampaign(): CampaignLibraryEntry | null {
  const raw = localStorage.getItem(LEGACY_CAMPAIGN_STORAGE_KEY);
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as GameState;
    if (!state?.campaign || !state?.character) return null;
    const now = campaignActivityAt(state);
    const entry: CampaignLibraryEntry = {
      id: crypto.randomUUID(),
      state,
      createdAt: now,
      updatedAt: now,
    };
    writeCampaignLibrary([entry]);
    localStorage.setItem(ACTIVE_CAMPAIGN_KEY, entry.id);
    localStorage.removeItem(LEGACY_CAMPAIGN_STORAGE_KEY);
    return entry;
  } catch {
    return null;
  }
}

export function sortCampaigns(campaigns: CampaignLibraryEntry[]) {
  return [...campaigns].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}
