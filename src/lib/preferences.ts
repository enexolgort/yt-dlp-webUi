import type { MediaType } from "../types";

/**
 * The add-download form remembers how you last used it (video vs audio,
 * quality, container, embeds...) so queueing "another one like that" is a
 * paste + Enter. Per-download fields (URL, tags, playlist items) are never
 * remembered.
 */
const STORAGE_KEY = "yt-dlp-ui:add-preferences";

export type Quality = "best" | "2160" | "1440" | "1080" | "720" | "480" | "custom";

export interface AddPreferences {
  type: MediaType;
  quality: Quality;
  customFormat: string;
  mergeFormat: string;
  audioFormat: string;
  embedThumbnail: boolean;
  embedMetadata: boolean;
  embedSubtitles: boolean;
  subtitles: string;
  rateLimit: string;
  outputTemplate: string;
}

export const DEFAULT_PREFERENCES: AddPreferences = {
  type: "video",
  quality: "best",
  customFormat: "",
  mergeFormat: "",
  audioFormat: "mp3",
  embedThumbnail: true,
  embedMetadata: true,
  embedSubtitles: false,
  subtitles: "",
  rateLimit: "",
  outputTemplate: "",
};

export function loadPreferences(): AddPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<AddPreferences>;
    const merged = { ...DEFAULT_PREFERENCES };
    for (const key of Object.keys(DEFAULT_PREFERENCES) as (keyof AddPreferences)[]) {
      if (typeof parsed[key] === typeof DEFAULT_PREFERENCES[key]) {
        (merged as Record<string, unknown>)[key] = parsed[key];
      }
    }
    return merged;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: AddPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

/** Maps a quality preset to a yt-dlp `-f` selector (undefined = yt-dlp's default "best") */
export function qualityToFormat(quality: Quality, customFormat: string): string | undefined {
  if (quality === "best") return undefined;
  if (quality === "custom") return customFormat.trim() || undefined;
  return `bv*[height<=${quality}]+ba/b[height<=${quality}]`;
}
