import type { DownloadJob } from "../types";
import { formatSpeed } from "../lib/format";

interface Props {
  downloads: DownloadJob[];
  connected: boolean;
}

/** The API has no /stats endpoint, so everything here is derived from the job list. */
export function StatsBar({ downloads, connected }: Props) {
  if (!connected && downloads.length === 0) {
    return <div className="stats-bar stats-bar--empty">Connecting to API{"…"}</div>;
  }

  const count = (...statuses: DownloadJob["status"][]) => downloads.filter((d) => statuses.includes(d.status)).length;
  const speed = downloads
    .filter((d) => d.status === "downloading")
    .reduce((sum, d) => sum + (d.progress.speed ?? 0), 0);

  return (
    <div className="stats-bar">
      <div className="stats-bar__item">
        <span className="stats-bar__value stats-bar__value--down">{formatSpeed(speed)}</span>
        <span className="stats-bar__label">down</span>
      </div>
      <div className="stats-bar__divider" />
      <div className="stats-bar__item">
        <span className="stats-bar__value">{count("downloading", "processing")}</span>
        <span className="stats-bar__label">active</span>
      </div>
      <div className="stats-bar__item">
        <span className="stats-bar__value">{count("queued")}</span>
        <span className="stats-bar__label">queued</span>
      </div>
      <div className="stats-bar__item">
        <span className="stats-bar__value">{count("completed")}</span>
        <span className="stats-bar__label">done</span>
      </div>
      <div className="stats-bar__item">
        <span className={`stats-bar__value${count("failed") ? " stats-bar__value--error" : ""}`}>{count("failed")}</span>
        <span className="stats-bar__label">failed</span>
      </div>
      <div className="stats-bar__item">
        <span className="stats-bar__value">{downloads.length}</span>
        <span className="stats-bar__label">total</span>
      </div>
    </div>
  );
}
