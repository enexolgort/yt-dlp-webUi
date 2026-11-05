import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ApiClient } from "./api";
import { loadSettings, saveSettings, type Settings } from "./settings";

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (next: Settings) => void;
  api: ApiClient;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());

  const updateSettings = useCallback((next: Settings) => {
    saveSettings(next);
    setSettings(loadSettings());
  }, []);

  // Only rebuild the client (and so re-trigger every poller) when the
  // connection itself changes, not when e.g. SFTP destinations are edited.
  const { baseUrl, apiKey } = settings;
  const api = useMemo(() => new ApiClient({ baseUrl, apiKey }), [baseUrl, apiKey]);

  const value = useMemo(() => ({ settings, updateSettings, api }), [settings, updateSettings, api]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
