import { useCallback, useEffect, useRef, useState } from "react";
import { useSettings } from "../lib/SettingsContext";
import { isActive } from "../lib/format";
import type { DownloadJob } from "../types";
import { useInterval } from "./useInterval";

// Poll fast while something is moving so progress bars feel live, back off
// when every job is finished.
const ACTIVE_POLL_MS = 1500;
const IDLE_POLL_MS = 5000;

interface UseDownloadsResult {
  downloads: DownloadJob[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useDownloads(): UseDownloadsResult {
  const { api } = useSettings();
  const [downloads, setDownloads] = useState<DownloadJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    api
      .listDownloads()
      .then((jobs) => {
        setDownloads(Array.isArray(jobs) ? jobs : []);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => {
        setLoading(false);
        inFlight.current = false;
      });
  }, [api]);

  // Refresh immediately whenever the api client changes (e.g. settings edited).
  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const anyActive = downloads.some((d) => isActive(d.status));
  useInterval(refresh, anyActive ? ACTIVE_POLL_MS : IDLE_POLL_MS);

  return { downloads, loading, error, refresh };
}
