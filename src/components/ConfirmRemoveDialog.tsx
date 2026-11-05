import { useState } from "react";
import { Modal } from "./Modal";
import { isActive, jobTitle } from "../lib/format";
import type { DownloadJob } from "../types";

interface Props {
  job: DownloadJob;
  onClose: () => void;
  onConfirm: (deleteFiles: boolean) => Promise<void> | void;
}

export function ConfirmRemoveDialog({ job, onClose, onConfirm }: Props) {
  const [deleteFiles, setDeleteFiles] = useState(job.status !== "completed");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleConfirm() {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onConfirm(deleteFiles);
      onClose();
    } catch (err) {
      setErrorMsg((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Remove download" onClose={onClose}>
      <p>
        Remove <strong>{jobTitle(job)}</strong> from the list?
      </p>
      {isActive(job.status) && <p className="muted">It's still {job.status}, so it will be cancelled first.</p>}
      <label className="field field--checkbox">
        <input type="checkbox" checked={deleteFiles} onChange={(e) => setDeleteFiles(e.target.checked)} />
        <span>Also delete its files from the server's disk</span>
      </label>
      {deleteFiles ? (
        <p className="form-warning">This permanently deletes the job's folder and can't be undone.</p>
      ) : (
        <p className="muted">
          The files stay on disk, but this UI can no longer list, save or push them once the job is removed.
        </p>
      )}
      {errorMsg && <p className="form-error">{errorMsg}</p>}
      <div className="modal__footer">
        <button type="button" className="button button--ghost" onClick={onClose} disabled={submitting}>
          Cancel
        </button>
        <button type="button" className="button button--danger" onClick={handleConfirm} disabled={submitting}>
          {submitting ? "Removing…" : deleteFiles ? "Delete files & remove" : "Remove"}
        </button>
      </div>
    </Modal>
  );
}
