import { useState } from "react";
import type { DownloadJob } from "../types";
import { formatBytes, formatEta, formatRelative, formatSpeed, isActive, jobTitle, urlHost } from "../lib/format";
import { ProgressBar } from "./ProgressBar";
import { StatusBadge } from "./StatusBadge";
import { FilesDialog } from "./FilesDialog";
import { PushSftpDialog } from "./PushSftpDialog";
import { ConfirmRemoveDialog } from "./ConfirmRemoveDialog";
import { useSettings } from "../lib/SettingsContext";
import { useToast } from "../lib/ToastContext";

interface Props {
  job: DownloadJob;
  onChanged: () => void;
}

function describeType(job: DownloadJob): string {
  const o = job.options;
  const audio = o.type ? o.type === "audio" : Boolean(o.audioOnly);
  if (audio) return `audio${o.audioFormat ? ` · ${o.audioFormat}` : ""}`;
  return `video${o.mergeFormat ? ` · ${o.mergeFormat}` : ""}`;
}

export function DownloadRow({ job, onChanged }: Props) {
  const { api } = useSettings();
  const { notify } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [showFiles, setShowFiles] = useState(false);
  const [showPush, setShowPush] = useState(false);
  const [showRemove, setShowRemove] = useState(false);

  const title = jobTitle(job);
  const active = isActive(job.status);
  const canRetry = job.status === "failed" || job.status === "cancelled";
  const p = job.progress;

  async function run(action: string, fn: () => Promise<unknown>, success?: string) {
    setBusy(action);
    try {
      await fn();
      if (success) notify(success, "success");
      onChanged();
    } catch (err) {
      notify(`${title}: ${(err as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  // One file (the common case) saves straight away; several open a picker.
  function handleFiles() {
    if (job.files.length === 1) {
      const file = job.files[0]!;
      run("save", () => api.saveFile(job.id, file.name));
    } else {
      setShowFiles(true);
    }
  }

  const totalSize = job.files.reduce((sum, f) => sum + f.size, 0);
  const meta: string[] = [describeType(job), urlHost(job.options.url)];
  if (active && p.downloadedBytes !== null) {
    meta.push(`${formatBytes(p.downloadedBytes)}${p.totalBytes ? ` / ${formatBytes(p.totalBytes)}` : ""}`);
  } else if (job.files.length) {
    meta.push(`${job.files.length} file${job.files.length === 1 ? "" : "s"} · ${formatBytes(totalSize)}`);
  }
  if (p.playlistIndex !== null && p.playlistCount !== null) meta.push(`item ${p.playlistIndex}/${p.playlistCount}`);
  meta.push(formatRelative(job.createdAt));

  return (
    <>
      <tr className="data-row">
        <td className="data-row__name" title={`${title}\n${job.options.url}`}>
          <div className="data-row__name-text">{title}</div>
          <div className="data-row__meta">{meta.join(" · ")}</div>
          {job.status === "failed" && job.error && (
            <div className="data-row__error" title={job.error}>
              {job.error}
            </div>
          )}
        </td>
        <td className="data-row__progress">
          <ProgressBar percent={p.percent} status={job.status} />
        </td>
        <td className="data-row__status">
          <StatusBadge job={job} />
        </td>
        <td className={`mono data-row__speed${p.speed && job.status === "downloading" ? "" : " data-row__cell--empty"}`}>
          {job.status === "downloading" ? formatSpeed(p.speed) : "--"}
        </td>
        <td className={`mono data-row__eta${p.eta !== null && job.status === "downloading" ? "" : " data-row__cell--empty"}`}>
          {job.status === "downloading" ? formatEta(p.eta) : "--"}
        </td>
        <td className="data-row__actions">
          <div className="data-row__actions-inner">
            {active && (
              <button
                className="icon-button"
                title="Cancel (keeps partial files)"
                disabled={busy !== null}
                onClick={() => run("cancel", () => api.cancelDownload(job.id))}
              >
                {busy === "cancel" ? "…" : "■"}
              </button>
            )}
            {canRetry && (
              <button
                className="icon-button"
                title="Retry with the same options"
                disabled={busy !== null}
                onClick={() => run("retry", () => api.createDownload(job.options), "Queued again")}
              >
                {busy === "retry" ? "…" : "↻"}
              </button>
            )}
            {job.files.length > 0 && (
              <button
                className="icon-button"
                title={job.files.length === 1 ? "Save file" : `Files (${job.files.length})`}
                disabled={busy !== null}
                onClick={handleFiles}
              >
                {busy === "save" ? "…" : "⤓"}
              </button>
            )}
            {job.status === "completed" && (
              <button
                className="icon-button"
                title="Push to remote (SFTP)"
                disabled={busy !== null}
                onClick={() => setShowPush(true)}
              >
                {"⇑"}
              </button>
            )}
            <button
              className="icon-button icon-button--danger"
              title="Remove"
              disabled={busy !== null}
              onClick={() => setShowRemove(true)}
            >
              {"✕"}
            </button>
          </div>
        </td>
      </tr>

      {showFiles && <FilesDialog job={job} onClose={() => setShowFiles(false)} />}

      {showPush && <PushSftpDialog job={job} onClose={() => setShowPush(false)} />}

      {showRemove && (
        <ConfirmRemoveDialog
          job={job}
          onClose={() => setShowRemove(false)}
          onConfirm={async (deleteFiles) => {
            await api.removeDownload(job.id, deleteFiles);
            notify(`Removed ${title}`, "success");
            onChanged();
          }}
        />
      )}
    </>
  );
}
