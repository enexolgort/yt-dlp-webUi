import type {
  ApiErrorBody,
  DownloadFile,
  DownloadJob,
  DownloadOptions,
  DownloadStatus,
  HealthResponse,
  MediaFormat,
  MediaInfo,
  TransferJob,
  UpdateResponse,
} from "../types";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export interface Connection {
  baseUrl: string;
  apiKey: string;
}

/** Encodes a job-relative file name for the URL, keeping "/" separators intact. */
function encodeFilePath(name: string): string {
  return name.split("/").map(encodeURIComponent).join("/");
}

/**
 * Thin wrapper around the yt-dlp-api HTTP endpoints described in
 * openapi.yaml. One instance is created per (baseUrl, apiKey) pair -- see
 * SettingsContext, which re-creates it whenever those change.
 */
export class ApiClient {
  constructor(private conn: Connection) {}

  private headers(extra?: HeadersInit): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(extra as Record<string, string> | undefined),
    };
    if (this.conn.apiKey) headers["X-API-Key"] = this.conn.apiKey;
    return headers;
  }

  private async send(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await fetch(`${this.conn.baseUrl}${path}`, {
        ...init,
        headers: this.headers({
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...(init.headers as Record<string, string> | undefined),
        }),
      });
    } catch (err) {
      throw new ApiError(
        0,
        `Could not reach ${this.conn.baseUrl} -- is the API running and is this address reachable from here? (${(err as Error).message})`,
      );
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await this.send(path, init);

    if (res.status === 204) return undefined as T;

    const isJson = res.headers.get("content-type")?.includes("application/json");
    const body = isJson ? await res.json().catch(() => undefined) : undefined;

    if (!res.ok) {
      const message = (body as ApiErrorBody | undefined)?.error ?? `Request failed with status ${res.status}`;
      throw new ApiError(res.status, message);
    }

    return body as T;
  }

  // ---------------------------------------------------------------- health / yt-dlp

  health(): Promise<HealthResponse> {
    return this.request("/health");
  }

  updateYtdlp(channel: string): Promise<UpdateResponse> {
    return this.request("/ytdlp/update", {
      method: "POST",
      body: JSON.stringify({ channel }),
    });
  }

  docsUrl(): string {
    return `${this.conn.baseUrl}/docs`;
  }

  // ---------------------------------------------------------------- metadata

  getInfo(url: string, playlist: boolean): Promise<MediaInfo> {
    const q = new URLSearchParams({ url });
    if (playlist) q.set("playlist", "true");
    return this.request(`/info?${q}`);
  }

  getFormats(url: string): Promise<MediaFormat[]> {
    return this.request(`/formats?${new URLSearchParams({ url })}`);
  }

  // ---------------------------------------------------------------- downloads

  listDownloads(status?: DownloadStatus): Promise<DownloadJob[]> {
    return this.request(status ? `/downloads?status=${status}` : "/downloads");
  }

  getDownload(id: string): Promise<DownloadJob> {
    return this.request(`/downloads/${id}`);
  }

  createDownload(options: DownloadOptions): Promise<DownloadJob> {
    return this.request("/downloads", {
      method: "POST",
      body: JSON.stringify(options),
    });
  }

  cancelDownload(id: string): Promise<DownloadJob> {
    return this.request(`/downloads/${id}/cancel`, { method: "POST" });
  }

  removeDownload(id: string, deleteFiles: boolean): Promise<void> {
    const query = deleteFiles ? "?deleteFiles=true" : "";
    return this.request(`/downloads/${id}${query}`, { method: "DELETE" });
  }

  listFiles(id: string): Promise<DownloadFile[]> {
    return this.request(`/downloads/${id}/files`);
  }

  fileUrl(id: string, name: string): string {
    return `${this.conn.baseUrl}/downloads/${id}/files/${encodeFilePath(name)}`;
  }

  /**
   * Saves a job's file to the user's device.
   *
   * Without an API key this is a plain navigation, so the browser streams
   * the file straight to disk. With a key we can't put the header on a
   * link, so the file is fetched into memory first and handed over as a
   * blob -- fine for normal videos, slow for multi-GB files.
   */
  async saveFile(id: string, name: string): Promise<void> {
    const basename = name.split("/").pop() || name;
    const a = document.createElement("a");
    a.download = basename;
    a.rel = "noopener";

    if (!this.conn.apiKey) {
      a.href = this.fileUrl(id, name);
      a.click();
      return;
    }

    const res = await this.send(`/downloads/${id}/files/${encodeFilePath(name)}`);
    if (!res.ok) {
      const body = (await res.json().catch(() => undefined)) as ApiErrorBody | undefined;
      throw new ApiError(res.status, body?.error ?? `Request failed with status ${res.status}`);
    }
    const blobUrl = URL.createObjectURL(await res.blob());
    a.href = blobUrl;
    a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }

  // ---------------------------------------------------------------- SFTP

  pushToSftp(id: string, remoteFolder: string): Promise<TransferJob> {
    return this.request(`/downloads/${id}/push-sftp`, {
      method: "POST",
      body: JSON.stringify({ remoteFolder }),
    });
  }

  listTransfers(): Promise<TransferJob[]> {
    return this.request("/transfers");
  }

  getTransfer(id: string): Promise<TransferJob> {
    return this.request(`/transfers/${id}`);
  }
}
