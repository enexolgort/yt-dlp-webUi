import { useEffect, useRef } from "react";

/**
 * Runs `callback` every `delayMs`. Automatically skips ticks while the
 * document is hidden (backgrounded tab) so we don't hammer the API from
 * every open tab that's just sitting in the background.
 */
export function useInterval(callback: () => void, delayMs: number | null): void {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (delayMs === null) return;
    const tick = () => {
      if (document.visibilityState === "visible") {
        savedCallback.current();
      }
    };
    const id = setInterval(tick, delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}
