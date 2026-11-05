import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";
import { useSettings } from "../lib/SettingsContext";
import { useToast } from "../lib/ToastContext";
import { formatBytes, jobTitle } from "../lib/format";
import type { DownloadJob, TransferJob } from "../types";

const POLL_MS = 1000;

interface Props {
  job: DownloadJob;
  onClose: () => void;
}

export function PushSftpDialog({ job, onClose }: Props) {
  const { api, settings } = useSettings();
  const { notify } = useToast();
  const [starting, setStarting] = useState<string | null>(null); // remoteFolder being started
  const [startError, setStartError] = useState<string | null>(null);
  const [customFolder, setCustomFolder] = useState("");
  const [transfer, setTransfer] = useState<TransferJob | null>(null);
  const pollRef = useRef<number | null>(null);
  const notifiedRef = useRef(false);
  const title = jobTitle(job);

  // Stop polling if the dialog unmounts -- the server-side transfer keeps
  // running regardless, and stays visible in the Transfers tab.
  useEffect(() => {
    return () => {
      if (pollRef.current !== null) window.clearInterval(pollRef.current);
    };
  }, []);

  async function startPush(remoteFolder: string) {
    setStarting(remoteFolder);
    setStartError(null);
    try {
      const accepted = await api.pushToSftp(job.id, remoteFolder);
      setTransfer(accepted);

      pollRef.current = window.setInterval(async () => {
        try {
          const t = await api.getTransfer(accepted.id);
          setTransfer(t);
          if (t.status === "completed" || t.status === "failed") {
            if (pollRef.current !== null) {
              window.clearInterval(pollRef.current);
              pollRef.current = null;
            }
            if (!notifiedRef.current) {
              notifiedRef.current = true;
              if (t.status === "completed") notify(`Pushed "${title}" to ${t.remoteFolder}`, "success");
              else notify(`Push failed: ${t.error ?? "unknown error"}`);
            }
          }
        } catch {
          // A transient poll failure shouldn't kill the whole flow --
          // just try again on the next tick.
        }
      }, POLL_MS);
    } catch (err) {
      setStartError((err as Error).message);
      setStarting(null);
    }
  }

  const pct = transfer && transfer.totalBytes > 0 ? Math.min(1, transfer.bytesTransferred / transfer.totalBytes) : 0;
  const isDone = transfer?.status === "completed";
  const isFailed = transfer?.status === "failed";
  const isRunning = Boolean(transfer) && !isDone && !isFailed;

  return (
    <Modal title="Push to remote" onClose={onClose}>
      {!transfer && (
        <>
          <p className="muted">
            Send <strong>{title}</strong> ({job.files.length} file{job.files.length === 1 ? "" : "s"}) to a folder on
            the API's SFTP server. Subfolders are kept.
          </p>
          {settings.sftpDestinations.length > 0 && (
            <div className="destination-list">
              {settings.sftpDestinations.map((d) => (
                <button
                  key={d.remoteFolder}
                  type="button"
                  className="destination-button"
                  disabled={starting !== null}
                  onClick={() => startPush(d.remoteFolder)}
                >
                  <span className="destination-button__label">{d.label || d.remoteFolder}</span>
                  <span className="destination-button__path mono">{d.remoteFolder}</span>
                  <span className="destination-button__status">
                    {starting === d.remoteFolder ? "Starting…" : "→"}
                  </span>
                </button>
              ))}
            </div>
          )}
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (customFolder.trim()) startPush(customFolder.trim());
            }}
          >
            <input
              type="text"
              className="text-input mono"
              placeholder="/other/remote/folder"
              value={customFolder}
              onChange={(e) => setCustomFolder(e.target.value)}
              aria-label="Custom remote folder"
            />
            <button
              type="submit"
              className="button button--ghost"
              disabled={!customFolder.trim() || starting !== null}
            >
              {starting === customFolder.trim() ? "Starting…" : "Push"}
            </button>
          </form>
          <p className="muted small">Quick-pick folders can be edited under Settings.</p>
          {startError && <p className="form-error">{startError}</p>}
        </>
      )}

      {transfer && (
        <div className="transfer-progress">
          <div className="transfer-progress__header">
            <span className="transfer-progress__folder mono">{transfer.remoteFolder}</span>
            <span className={`transfer-status transfer-status--${transfer.status}`}>
              {transfer.status === "pending" && "Starting…"}
              {transfer.status === "running" && "Uploading…"}
              {transfer.status === "completed" && "Done"}
              {transfer.status === "failed" && "Failed"}
            </span>
          </div>

          <div
            className="progress progress--large"
            role="progressbar"
            aria-valuenow={Math.round(pct * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`progress__fill progress__fill--transfer${isRunning ? " progress__fill--active" : ""}${
                isDone ? " progress__fill--done" : ""
              }${isFailed ? " progress__fill--failed" : ""}`}
              style={{ width: `${(isDone ? 1 : pct) * 100}%` }}
            />
            <span className="progress__label">
              {isDone ? "100%" : transfer.totalBytes > 0 ? `${Math.round(pct * 100)}%` : "…"}
            </span>
          </div>

          <div className="transfer-progress__meta mono">
            {formatBytes(transfer.bytesTransferred)}
            {transfer.totalBytes > 0 ? ` / ${formatBytes(transfer.totalBytes)}` : ""}
            {transfer.currentFile ? ` · ${transfer.currentFile}` : ""}
          </div>

          {isFailed && transfer.error && <p className="form-error">{transfer.error}</p>}

          <div className="modal__footer">
            {isDone || isFailed ? (
              <button type="button" className="button button--primary" onClick={onClose}>
                Close
              </button>
            ) : (
              <button type="button" className="button button--ghost" onClick={onClose}>
                Run in background
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
