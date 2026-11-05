export type View = "downloads" | "transfers" | "settings";

interface Props {
  view: View;
  onViewChange: (v: View) => void;
  onAddClick: () => void;
}

const TABS: { id: View; label: string }[] = [
  { id: "downloads", label: "Downloads" },
  { id: "transfers", label: "Transfers" },
  { id: "settings", label: "Settings & yt-dlp" },
];

export function Header({ view, onViewChange, onAddClick }: Props) {
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="app-header__mark" aria-hidden>
          {"▶"}
        </span>
        <span>yt-dlp</span>
      </div>

      <nav className="app-header__nav" role="tablist" aria-label="View">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={view === t.id}
            className={`app-header__tab${view === t.id ? " app-header__tab--active" : ""}`}
            onClick={() => onViewChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {view === "downloads" && (
        <button className="button button--primary" onClick={onAddClick}>
          + Add download
        </button>
      )}
    </header>
  );
}
