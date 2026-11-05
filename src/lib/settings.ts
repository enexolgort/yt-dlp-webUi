const STORAGE_KEY = "yt-dlp-ui:settings";

export interface SftpDestination {
  label: string;
  remoteFolder: string;
}

export interface Settings {
  baseUrl: string;
  apiKey: string;
  /** Quick-pick folders shown in the "Push to remote" dialog */
  sftpDestinations: SftpDestination[];
}

const DEFAULTS: Settings = {
  baseUrl: "http://localhost:3000",
  apiKey: "",
  sftpDestinations: [
    { label: "Movies", remoteFolder: "/upload/Movies" },
    { label: "Music", remoteFolder: "/upload/Music" },
  ],
};

function parseDestinations(value: unknown): SftpDestination[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .filter(
      (d): d is SftpDestination =>
        typeof d === "object" && d !== null && typeof d.label === "string" && typeof d.remoteFolder === "string",
    )
    .map((d) => ({ label: d.label, remoteFolder: d.remoteFolder }));
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      baseUrl: typeof parsed.baseUrl === "string" && parsed.baseUrl ? parsed.baseUrl : DEFAULTS.baseUrl,
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : DEFAULTS.apiKey,
      sftpDestinations: parseDestinations(parsed.sftpDestinations) ?? DEFAULTS.sftpDestinations,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(settings: Settings): void {
  // Trim trailing slash so we don't end up with double slashes when building URLs.
  const normalized: Settings = {
    baseUrl: settings.baseUrl.trim().replace(/\/+$/, "") || DEFAULTS.baseUrl,
    apiKey: settings.apiKey.trim(),
    sftpDestinations: settings.sftpDestinations
      .map((d) => ({ label: d.label.trim(), remoteFolder: d.remoteFolder.trim() }))
      .filter((d) => d.remoteFolder),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Storage blocked (private mode etc.) -- settings just won't persist.
  }
}
