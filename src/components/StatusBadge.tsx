import type { DownloadJob } from "../types";
import { getStatusMeta } from "../lib/format";

export function StatusBadge({ job }: { job: DownloadJob }) {
  const meta = getStatusMeta(job.status);
  const isError = job.status === "failed";

  return (
    <span
      className={`status-badge${meta.animated ? " status-badge--animated" : ""}${isError ? " status-badge--error" : ""}`}
      style={{ ["--dot-color" as string]: `var(${meta.colorVar})` }}
      title={isError && job.error ? job.error : undefined}
    >
      <span className="status-badge__dot" />
      {meta.label}
    </span>
  );
}
