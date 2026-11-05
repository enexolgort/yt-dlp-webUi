import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { useSettings } from "../lib/SettingsContext";
import { useToast } from "../lib/ToastContext";
import { formatBytes, jobTitle } from "../lib/format";
import type { DownloadFile, DownloadJob } from "../types";

interface Props {
  job: DownloadJob;
  onClose: () => void;
}

export function FilesDialog({ job, onClose }: Props) {
  const { api, settings } = useSettings();
  const { notify } = useToast();
  const [files, setFiles] = useState<DownloadFile[]>(job.files);
  const [saving, setSaving] = useState<string | null>(null);

  // The list endpoint doesn't refresh files of running jobs, the per-job
  // endpoint does -- fetch it so partial playlist results show up.
  useEffect(() => {
    let cancelled = false;
    api
      .listFiles(job.id)
      .then((list) => !cancelled && setFiles(list))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [api, job.id]);

  async function save(name: string) {
    setSaving(name);
    try {
      await api.saveFile(job.id, name);
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setSaving(null);
    }
  }

  const total = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <Modal title="Files" onClose={onClose}>
      <p className="muted">
        <strong>{jobTitle(job)}</strong> {"·"} {files.length} file{files.length === 1 ? "" : "s"} {"·"}{" "}
        {formatBytes(total)}
      </p>
      {settings.apiKey && (
        <p className="muted small">
          With an API key set, files are loaded into the browser before saving, so large files take a moment to start.
        </p>
      )}
      <ul className="file-list">
        {files.map((f) => (
          <li key={f.name} className="file-list__item">
            <div className="file-list__name mono" title={f.name}>
              {f.name}
            </div>
            <span className="file-list__size mono">{formatBytes(f.size)}</span>
            <button
              type="button"
              className="button button--ghost button--small"
              disabled={saving !== null}
              onClick={() => save(f.name)}
            >
              {saving === f.name ? "Saving…" : "Save"}
            </button>
          </li>
        ))}
      </ul>
      <div className="modal__footer">
        <button type="button" className="button button--primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
