import { useEffect, useState } from "react";
import { Header, type View } from "./components/Header";
import { DownloadTable } from "./components/DownloadTable";
import { StatsBar } from "./components/StatsBar";
import { SettingsPanel } from "./components/SettingsPanel";
import { TransfersPanel } from "./components/TransfersPanel";
import { AddDownloadDialog } from "./components/AddDownloadDialog";
import { useDownloads } from "./hooks/useDownloads";

function looksLikeUrl(text: string): boolean {
  return /^https?:\/\/\S+$/i.test(text.trim().split(/\s+/)[0] ?? "");
}

/** `?url=...` lets a bookmarklet or share shortcut open the add dialog prefilled. */
function takeUrlFromQuery(): string | null {
  const params = new URLSearchParams(window.location.search);
  const url = params.get("url");
  if (!url) return null;
  params.delete("url");
  const rest = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (rest ? `?${rest}` : "") + window.location.hash);
  return url;
}

export default function App() {
  const [view, setView] = useState<View>("downloads");
  const [addUrl, setAddUrl] = useState<string | null>(() => takeUrlFromQuery());
  const { downloads, loading, error, refresh } = useDownloads();

  const openAdd = (url = "") => setAddUrl(url);

  // Paste a link anywhere on the page (outside a text field) to queue it.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (addUrl !== null) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      if (document.querySelector(".modal-backdrop")) return;
      const text = e.clipboardData?.getData("text") ?? "";
      if (!looksLikeUrl(text)) return;
      e.preventDefault();
      setView("downloads");
      setAddUrl(text.trim());
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addUrl]);

  return (
    <div className="app">
      <Header view={view} onViewChange={setView} onAddClick={() => openAdd()} />

      {view === "downloads" && (
        <main className="app-main">
          <StatsBar downloads={downloads} connected={!error && !loading} />
          <DownloadTable
            downloads={downloads}
            loading={loading}
            error={error}
            onChanged={refresh}
            onAddClick={() => openAdd()}
          />
        </main>
      )}

      {view === "transfers" && (
        <main className="app-main">
          <TransfersPanel downloads={downloads} />
        </main>
      )}

      {view === "settings" && (
        <main className="app-main">
          <SettingsPanel />
        </main>
      )}

      {addUrl !== null && (
        <AddDownloadDialog initialUrl={addUrl} onClose={() => setAddUrl(null)} onAdded={refresh} />
      )}
    </div>
  );
}
