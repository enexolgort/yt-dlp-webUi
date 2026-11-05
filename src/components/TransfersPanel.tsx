import { useMemo } from "react";
import { useTransfers } from "../hooks/useTransfers";
import { formatBytes, formatRelative, jobTitle } from "../lib/format";
import type { DownloadJob, TransferJob } from "../types";

interface Props {
  downloads: DownloadJob[];
}

const STATUS_LABEL: Record<TransferJob["status"], string> = {
  pending: "Starting",
  running: "Uploading",
  completed: "Done",
  failed: "Failed",
};

export function TransfersPanel({ downloads }: Props) {
  const { transfers, loading, error, refresh } = useTransfers();
  const titles = useMemo(() => new Map(downloads.map((d) => [d.id, jobTitle(d)])), [downloads]);

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        <div>
          <strong>SFTP transfers</strong>
          <span className="muted small"> {"·"} pushes from completed downloads to the remote server</span>
        </div>
        <button className="button button--ghost button--small" onClick={refresh}>
          Refresh
        </button>
      </div>

      {error && <div className="banner banner--error">Couldn't load transfers: {error}</div>}

      {!error && loading && transfers.length === 0 && <div className="empty-state">Loading transfers{"…"}</div>}

      {!error && !loading && transfers.length === 0 && (
        <div className="empty-state">
          <p>No transfers yet.</p>
          <p className="muted">
            Use the {"⇑"} button on a completed download to push it to your SFTP server.
          </p>
        </div>
      )}

      {transfers.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Download</th>
              <th>Progress</th>
              <th>Status</th>
              <th>Transferred</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => {
              const pct = t.status === "completed" ? 100 : Math.max(0, Math.min(100, t.percent ?? 0));
              const running = t.status === "pending" || t.status === "running";
              return (
                <tr key={t.id} className="data-row data-row--transfer">
                  <td className="data-row__name" title={t.downloadId}>
                    <div className="data-row__name-text">{titles.get(t.downloadId) ?? "Removed download"}</div>
                    <div className="data-row__meta">
                      {"→"} {t.remoteFolder}
                      {t.currentFile && running ? ` · ${t.currentFile}` : ""}
                    </div>
                    {t.status === "failed" && t.error && (
                      <div className="data-row__error" title={t.error}>
                        {t.error}
                      </div>
                    )}
                  </td>
                  <td className="data-row__progress">
                    <div className="progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
                      <div
                        className={`progress__fill progress__fill--transfer${running ? " progress__fill--active" : ""}${
                          t.status === "completed" ? " progress__fill--done" : ""
                        }${t.status === "failed" ? " progress__fill--failed" : ""}`}
                        style={{ width: `${pct}%` }}
                      />
                      <span className="progress__label">{pct.toFixed(pct < 100 ? 1 : 0)}%</span>
                    </div>
                  </td>
                  <td className="data-row__status">
                    <span className={`transfer-status transfer-status--${t.status}`}>{STATUS_LABEL[t.status]}</span>
                  </td>
                  <td className="mono data-row__speed">
                    {formatBytes(t.bytesTransferred)}
                    {t.totalBytes > 0 ? ` / ${formatBytes(t.totalBytes)}` : ""}
                  </td>
                  <td className="mono data-row__eta">{formatRelative(t.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
