import { useMemo, useState } from "react";
import type { DownloadJob, DownloadStatus } from "../types";
import { jobTitle } from "../lib/format";
import { DownloadRow } from "./DownloadRow";

interface Props {
  downloads: DownloadJob[];
  loading: boolean;
  error: string | null;
  onChanged: () => void;
  onAddClick: () => void;
}

type Filter = "all" | "active" | "completed" | "failed";

const FILTERS: { id: Filter; label: string; statuses: DownloadStatus[] | null }[] = [
  { id: "all", label: "All", statuses: null },
  { id: "active", label: "Active", statuses: ["queued", "downloading", "processing"] },
  { id: "completed", label: "Completed", statuses: ["completed"] },
  { id: "failed", label: "Failed", statuses: ["failed", "cancelled"] },
];

const STATUS_ORDER: Record<DownloadStatus, number> = {
  downloading: 0,
  processing: 0,
  queued: 1,
  failed: 2,
  completed: 3,
  cancelled: 3,
};

export function DownloadTable({ downloads, loading, error, onChanged, onAddClick }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: downloads.length, active: 0, completed: 0, failed: 0 };
    for (const f of FILTERS) {
      if (f.statuses) c[f.id] = downloads.filter((d) => f.statuses!.includes(d.status)).length;
    }
    return c;
  }, [downloads]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const statuses = FILTERS.find((f) => f.id === filter)?.statuses;
    return downloads
      .filter((d) => !statuses || statuses.includes(d.status))
      .filter(
        (d) =>
          !needle || jobTitle(d).toLowerCase().includes(needle) || d.options.url.toLowerCase().includes(needle),
      )
      .sort((a, b) => {
        const orderDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (orderDiff !== 0) return orderDiff;
        // Queue order for queued jobs, newest first for everything else
        if (a.status === "queued") return a.createdAt.localeCompare(b.createdAt);
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [downloads, query, filter]);

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        <input
          type="search"
          placeholder={"Filter by title or URL…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="filter-input"
          aria-label="Filter downloads"
        />
        <div className="chip-group" role="tablist" aria-label="Status filter">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              className={`chip${filter === f.id ? " chip--active" : ""}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span className="chip__count">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div className="banner banner--error">Couldn't reach the API: {error}</div>}

      {!error && loading && downloads.length === 0 && <div className="empty-state">Loading downloads{"…"}</div>}

      {!error && !loading && downloads.length === 0 && (
        <div className="empty-state">
          <p>No downloads yet.</p>
          <button className="button button--primary" onClick={onAddClick}>
            Add your first download
          </button>
          <p className="muted empty-state__hint">Tip: paste a link anywhere on this page to queue it.</p>
        </div>
      )}

      {!error && downloads.length > 0 && visible.length === 0 && (
        <div className="empty-state">Nothing matches this filter.</div>
      )}

      {visible.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Progress</th>
              <th>Status</th>
              <th>Speed</th>
              <th>ETA</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {visible.map((d) => (
              <DownloadRow key={d.id} job={d} onChanged={onChanged} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
