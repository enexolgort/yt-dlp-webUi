import type { DownloadStatus } from "../types";

interface Props {
  percent: number | null; // 0..100, null while yt-dlp is still extracting
  status: DownloadStatus;
}

export function ProgressBar({ percent, status }: Props) {
  const known = percent !== null && Number.isFinite(percent);
  let pct = known ? Math.max(0, Math.min(100, percent)) : 0;
  if (status === "completed") pct = 100;

  // Processing (merge / convert / embed) has no progress of its own, so the
  // bar fills and keeps moving to show yt-dlp is still busy.
  const indeterminate = (status === "downloading" && !known) || status === "processing";
  const active = status === "downloading" || status === "processing";
  const width = status === "processing" ? 100 : indeterminate ? 100 : pct;

  let label: string;
  if (status === "processing") label = "processing";
  else if (status === "queued") label = "queued";
  else if (indeterminate) label = "starting…";
  else if ((status === "failed" || status === "cancelled") && !pct) label = status;
  else label = `${pct.toFixed(pct < 100 ? 1 : 0)}%`;

  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`progress__fill progress__fill--${status}${active ? " progress__fill--active" : ""}${
          indeterminate ? " progress__fill--indeterminate" : ""
        }`}
        style={{ width: `${width}%` }}
      />
      <span className="progress__label">{label}</span>
    </div>
  );
}
