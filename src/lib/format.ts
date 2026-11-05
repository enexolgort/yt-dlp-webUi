import type { DownloadJob, DownloadStatus } from "../types";

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return "--";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

export function formatSpeed(bytesPerSec: number | null | undefined): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "--";
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds < 0) return "--";
  seconds = Math.round(seconds);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ${seconds % 60}s`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/** Media duration, e.g. 3:07 or 1:02:45 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds < 0) return "--";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "--";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(diff)) return "--";
  if (diff < 45) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

/** yt-dlp upload_date "20240131" -> "2024-01-31" */
export function formatUploadDate(raw: string | null | undefined): string | null {
  if (!raw || !/^\d{8}$/.test(raw)) return raw ?? null;
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

export function formatCount(n: number | null | undefined): string | null {
  if (n === null || n === undefined) return null;
  return new Intl.NumberFormat(undefined, { notation: "compact" }).format(n);
}

export function isActive(status: DownloadStatus): boolean {
  return status === "queued" || status === "downloading" || status === "processing";
}

/**
 * Best human-readable name for a job. The API doesn't store the media
 * title on the job itself, so fall back through: the title yt-dlp reported
 * while downloading -> the first output file -> the URL.
 */
export function jobTitle(job: DownloadJob): string {
  if (job.options.metadata?.title) return job.options.metadata.title;
  if (job.progress.currentTitle) return job.progress.currentTitle;
  const first = job.files[0]?.name;
  if (first) {
    const base = first.split("/")[0]!;
    return base.replace(/\.[a-z0-9]{2,5}$/i, "");
  }
  return job.options.url;
}

export function urlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export interface StatusMeta {
  label: string;
  colorVar: string;
  animated: boolean;
}

const STATUS_META: Record<DownloadStatus, StatusMeta> = {
  queued: { label: "Queued", colorVar: "--status-queued", animated: false },
  downloading: { label: "Downloading", colorVar: "--status-downloading", animated: true },
  processing: { label: "Processing", colorVar: "--status-processing", animated: true },
  completed: { label: "Completed", colorVar: "--status-completed", animated: false },
  failed: { label: "Failed", colorVar: "--status-error", animated: false },
  cancelled: { label: "Cancelled", colorVar: "--status-stopped", animated: false },
};

export function getStatusMeta(status: DownloadStatus): StatusMeta {
  return STATUS_META[status] ?? { label: status, colorVar: "--status-stopped", animated: false };
}
