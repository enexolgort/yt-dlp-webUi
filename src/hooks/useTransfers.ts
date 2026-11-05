import { useCallback, useEffect, useState } from "react";
import { useSettings } from "../lib/SettingsContext";
import type { TransferJob } from "../types";
import { useInterval } from "./useInterval";

const ACTIVE_POLL_MS = 1500;
const IDLE_POLL_MS = 5000;

export function useTransfers() {
  const { api } = useSettings();
  const [transfers, setTransfers] = useState<TransferJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api
      .listTransfers()
      .then((list) => {
        setTransfers(Array.isArray(list) ? list : []);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const anyActive = transfers.some((t) => t.status === "pending" || t.status === "running");
  useInterval(refresh, anyActive ? ACTIVE_POLL_MS : IDLE_POLL_MS);

  return { transfers, loading, error, refresh };
}
