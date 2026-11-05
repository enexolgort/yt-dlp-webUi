// Mirrors components.schemas in openapi.yaml (enexolgort/yt-dlp-API)

export type DownloadStatus = "queued" | "downloading" | "processing" | "completed" | "failed" | "cancelled";

export type MediaType = "video" | "audio";

export interface MetadataTags {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  date?: string;
  track?: string;
  composer?: string;
  comment?: string;
}

export interface DownloadOptions {
  url: string;
  type?: MediaType;
  format?: string;
  audioOnly?: boolean; // deprecated on the API side, never sent by this UI
  audioFormat?: string;
  mergeFormat?: string;
  playlist?: boolean;
  playlistItems?: string;
  subtitles?: string[];
  embedSubtitles?: boolean;
  embedThumbnail?: boolean;
  embedMetadata?: boolean;
  metadata?: MetadataTags;
  splitChapters?: boolean;
  keepOriginal?: boolean;
  chapterTemplate?: string;
  rateLimit?: string;
  outputTemplate?: string;
}

export interface DownloadProgress {
  percent: number | null;
  downloadedBytes: number | null;
  totalBytes: number | null;
  speed: number | null; // bytes/sec
  eta: number | null; // seconds
  currentTitle: string | null;
  playlistIndex: number | null;
  playlistCount: number | null;
}

export interface DownloadFile {
  name: string; // relative to the job folder, may contain "/"
  size: number;
}

export interface DownloadJob {
  id: string;
  status: DownloadStatus;
  options: DownloadOptions;
  progress: DownloadProgress;
  files: DownloadFile[];
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export type TransferStatus = "pending" | "running" | "completed" | "failed";

export interface TransferJob {
  id: string;
  downloadId: string;
  remoteFolder: string;
  status: TransferStatus;
  bytesTransferred: number;
  totalBytes: number;
  percent: number;
  currentFile: string | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface MediaFormat {
  formatId: string;
  ext: string;
  resolution: string | null;
  fps: number | null;
  vcodec: string | null;
  acodec: string | null;
  filesize: number | null;
  tbr: number | null;
  note: string | null;
}

export interface MediaInfo {
  id: string;
  type: "video" | "playlist";
  title: string;
  url: string;
  extractor: string;
  uploader: string | null;
  channel: string | null;
  duration: number | null;
  uploadDate: string | null;
  viewCount: number | null;
  isLive: boolean | null;
  thumbnail: string | null;
  description: string | null;
  formats?: MediaFormat[];
  entries?: Array<{ id: string; title: string | null; url: string | null; duration: number | null }>;
}

export interface HealthResponse {
  status: string;
  ytdlp?: string;
  error?: string;
}

export interface UpdateResponse {
  version: string;
  output: string;
}

export interface ApiErrorBody {
  error?: string;
}
