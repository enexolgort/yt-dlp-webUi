import { useMemo, useRef, useState } from "react";
import { Modal } from "./Modal";
import { MediaPreview } from "./MediaPreview";
import { useSettings } from "../lib/SettingsContext";
import { useToast } from "../lib/ToastContext";
import {
  loadPreferences,
  qualityToFormat,
  savePreferences,
  type AddPreferences,
  type Quality,
} from "../lib/preferences";
import type { DownloadOptions, MediaFormat, MediaInfo, MetadataTags } from "../types";

interface Props {
  initialUrl?: string;
  onClose: () => void;
  onAdded: () => void;
}

const VIDEO_QUALITIES: { id: Quality; label: string }[] = [
  { id: "best", label: "Best available" },
  { id: "2160", label: "≤ 2160p (4K)" },
  { id: "1440", label: "≤ 1440p" },
  { id: "1080", label: "≤ 1080p" },
  { id: "720", label: "≤ 720p" },
  { id: "480", label: "≤ 480p" },
  { id: "custom", label: "Custom format…" },
];

const AUDIO_QUALITIES: { id: Quality; label: string }[] = [
  { id: "best", label: "Best audio" },
  { id: "custom", label: "Custom format…" },
];

const MERGE_FORMATS = ["", "mp4", "mkv", "webm", "mov"];
const AUDIO_FORMATS = ["best", "mp3", "m4a", "opus", "flac", "wav", "aac", "vorbis"];

const TAG_FIELDS: { key: keyof MetadataTags; label: string; placeholder?: string }[] = [
  { key: "title", label: "Title" },
  { key: "artist", label: "Artist" },
  { key: "album", label: "Album" },
  { key: "albumArtist", label: "Album artist" },
  { key: "genre", label: "Genre" },
  { key: "date", label: "Date / year", placeholder: "2024" },
  { key: "track", label: "Track", placeholder: "3/12" },
  { key: "composer", label: "Composer" },
  { key: "comment", label: "Comment" },
];

function parseUrls(text: string): string[] {
  const seen = new Set<string>();
  return text
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => s && !seen.has(s) && (seen.add(s), true));
}

export function AddDownloadDialog({ initialUrl = "", onClose, onAdded }: Props) {
  const { api } = useSettings();
  const { notify } = useToast();

  const savedPrefs = useRef(loadPreferences());
  const [prefs, setPrefs] = useState<AddPreferences>(savedPrefs.current);
  // True when the format came from clicking a row in the inspected format
  // list -- that's specific to one video, so it isn't remembered.
  const pickedFormat = useRef(false);

  const [urlText, setUrlText] = useState(initialUrl);
  const [playlist, setPlaylist] = useState(false);
  const [playlistItems, setPlaylistItems] = useState("");
  const [splitChapters, setSplitChapters] = useState(false);
  const [keepOriginal, setKeepOriginal] = useState(false);
  const [tags, setTags] = useState<MetadataTags>({});

  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const urls = useMemo(() => parseUrls(urlText), [urlText]);
  const invalidUrl = urls.find((u) => !/^https?:\/\/\S+$/i.test(u));
  const isAudio = prefs.type === "audio";
  const quality: Quality = isAudio && prefs.quality !== "custom" ? "best" : prefs.quality;
  const tagCount = Object.values(tags).filter((v) => v?.trim()).length;

  const set = <K extends keyof AddPreferences>(key: K, value: AddPreferences[K]) => {
    if (key === "quality" || key === "customFormat" || key === "type") pickedFormat.current = false;
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  async function inspect() {
    if (urls.length !== 1 || invalidUrl) return;
    setInspecting(true);
    setInspectError(null);
    setInfo(null);
    try {
      const result = await api.getInfo(urls[0]!, playlist);
      setInfo(result);
      if (result.type === "playlist") setPlaylist(true);
    } catch (err) {
      setInspectError((err as Error).message);
    } finally {
      setInspecting(false);
    }
  }

  function pickFormat(f: MediaFormat) {
    const audioOnly = !f.vcodec && Boolean(f.acodec);
    // A video-only stream needs an audio track merged in, or the file is silent.
    const selector = f.vcodec && !f.acodec ? `${f.formatId}+ba/b` : f.formatId;
    setPrefs((p) => ({ ...p, type: audioOnly ? "audio" : "video", quality: "custom", customFormat: selector }));
    pickedFormat.current = true;
  }

  function buildOptions(url: string): DownloadOptions {
    const o: DownloadOptions = { url, type: prefs.type };
    const format = qualityToFormat(quality, prefs.customFormat);
    if (format) o.format = format;

    if (isAudio) {
      if (prefs.audioFormat && prefs.audioFormat !== "best") o.audioFormat = prefs.audioFormat;
    } else if (prefs.mergeFormat) {
      o.mergeFormat = prefs.mergeFormat;
    }

    if (playlist) {
      o.playlist = true;
      if (playlistItems.trim()) o.playlistItems = playlistItems.trim();
    }

    const subs = prefs.subtitles
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (subs.length) {
      o.subtitles = subs;
      if (prefs.embedSubtitles && !isAudio) o.embedSubtitles = true;
    }

    if (prefs.embedThumbnail) o.embedThumbnail = true;
    if (prefs.embedMetadata) o.embedMetadata = true;

    const metadata: MetadataTags = {};
    for (const { key } of TAG_FIELDS) {
      const v = tags[key]?.trim();
      if (v) metadata[key] = v;
    }
    if (Object.keys(metadata).length) o.metadata = metadata;

    if (splitChapters) {
      o.splitChapters = true;
      if (keepOriginal) o.keepOriginal = true;
    }
    if (prefs.rateLimit.trim()) o.rateLimit = prefs.rateLimit.trim();
    if (prefs.outputTemplate.trim()) o.outputTemplate = prefs.outputTemplate.trim();
    return o;
  }

  const canSubmit = urls.length > 0 && !invalidUrl && !(quality === "custom" && !prefs.customFormat.trim());

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);

    const failures: string[] = [];
    let queued = 0;
    for (const url of urls) {
      try {
        await api.createDownload(buildOptions(url));
        queued++;
      } catch (err) {
        failures.push(`${url}: ${(err as Error).message}`);
      }
    }

    savePreferences(
      pickedFormat.current
        ? { ...prefs, type: savedPrefs.current.type, quality: savedPrefs.current.quality, customFormat: savedPrefs.current.customFormat }
        : prefs,
    );

    if (queued) {
      notify(
        queued === 1 ? `Queued: ${info?.title ?? urls[0]}` : `Queued ${queued} downloads`,
        "success",
      );
      onAdded();
    }
    setSubmitting(false);
    if (failures.length) {
      // Keep only the URLs that failed in the box so they can be fixed and resubmitted.
      setUrlText(urls.filter((u) => failures.some((f) => f.startsWith(`${u}:`))).join("\n"));
      setErrorMsg(failures.join("\n"));
    } else {
      onClose();
    }
  }

  return (
    <Modal title="Add download" onClose={onClose} wide>
      <form onSubmit={handleSubmit} className="add-form">
        <label className="field">
          <span>
            URL{urls.length > 1 ? `s (${urls.length} — one job each)` : ""}
          </span>
          <div className="url-row">
            <textarea
              className="text-input url-row__input"
              rows={urls.length > 1 ? Math.min(6, urls.length) : 1}
              placeholder="https://www.youtube.com/watch?v=... (one per line for several)"
              value={urlText}
              onChange={(e) => {
                setUrlText(e.target.value);
                setInfo(null);
                setInspectError(null);
              }}
              onKeyDown={(e) => {
                // Enter submits for a single URL; Shift+Enter adds a line.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              autoFocus
              spellCheck={false}
            />
            <button
              type="button"
              className="button button--ghost"
              onClick={inspect}
              disabled={urls.length !== 1 || Boolean(invalidUrl) || inspecting}
              title="Fetch title, duration and formats without downloading"
            >
              {inspecting ? "Inspecting…" : "Inspect"}
            </button>
          </div>
          {invalidUrl && <span className="form-error">Not an http(s) URL: {invalidUrl}</span>}
        </label>

        {inspectError && <div className="banner banner--error banner--inline">{inspectError}</div>}
        {info && <MediaPreview info={info} onUseFormat={pickFormat} selectedFormat={prefs.customFormat} />}

        <div className="tab-strip" role="tablist" aria-label="Media type">
          {(["video", "audio"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={prefs.type === t}
              className={`tab-strip__tab${prefs.type === t ? " tab-strip__tab--active" : ""}`}
              onClick={() => set("type", t)}
            >
              {t === "video" ? "Video" : "Audio only"}
            </button>
          ))}
        </div>

        <div className="field-grid">
          <label className="field">
            <span>{isAudio ? "Source" : "Quality"}</span>
            <select
              className="select"
              value={quality}
              onChange={(e) => set("quality", e.target.value as Quality)}
            >
              {(isAudio ? AUDIO_QUALITIES : VIDEO_QUALITIES).map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label}
                </option>
              ))}
            </select>
          </label>

          {isAudio ? (
            <label className="field">
              <span>Convert to</span>
              <select
                className="select"
                value={prefs.audioFormat || "best"}
                onChange={(e) => set("audioFormat", e.target.value)}
              >
                {AUDIO_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f === "best" ? "Keep original codec" : f}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field">
              <span>Container</span>
              <select className="select" value={prefs.mergeFormat} onChange={(e) => set("mergeFormat", e.target.value)}>
                {MERGE_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f || "Automatic"}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {quality === "custom" && (
          <label className="field">
            <span>Format selector (yt-dlp -f)</span>
            <input
              type="text"
              className="text-input mono"
              placeholder={isAudio ? "bestaudio[ext=m4a]/bestaudio" : "bv*[vcodec^=avc1]+ba[ext=m4a]/b"}
              value={prefs.customFormat}
              onChange={(e) => set("customFormat", e.target.value)}
              spellCheck={false}
            />
          </label>
        )}

        <div className="checkbox-row">
          <label className="field field--checkbox">
            <input
              type="checkbox"
              checked={prefs.embedThumbnail}
              onChange={(e) => set("embedThumbnail", e.target.checked)}
            />
            <span>Embed thumbnail</span>
          </label>
          <label className="field field--checkbox">
            <input
              type="checkbox"
              checked={prefs.embedMetadata}
              onChange={(e) => set("embedMetadata", e.target.checked)}
            />
            <span>Embed metadata</span>
          </label>
          <label className="field field--checkbox">
            <input type="checkbox" checked={playlist} onChange={(e) => setPlaylist(e.target.checked)} />
            <span>Whole playlist</span>
          </label>
        </div>

        {playlist && (
          <label className="field">
            <span>Playlist items (optional)</span>
            <input
              type="text"
              className="text-input mono"
              placeholder="1-5,8  (blank = all)"
              value={playlistItems}
              onChange={(e) => setPlaylistItems(e.target.value)}
            />
          </label>
        )}

        <details className="disclosure">
          <summary>
            Tags{tagCount ? ` (${tagCount})` : ""} <span className="disclosure__hint">artist, album, title{"…"}</span>
          </summary>
          <p className="muted small">Overrides what yt-dlp extracted. Leave blank to keep the original.</p>
          <div className="field-grid">
            {TAG_FIELDS.map(({ key, label, placeholder }) => (
              <label key={key} className="field">
                <span>{label}</span>
                <input
                  type="text"
                  className="text-input"
                  placeholder={placeholder}
                  value={tags[key] ?? ""}
                  onChange={(e) => setTags((t) => ({ ...t, [key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        </details>

        <details className="disclosure">
          <summary>
            Advanced <span className="disclosure__hint">chapters, subtitles, rate limit, filename</span>
          </summary>

          <label className="field field--checkbox">
            <input type="checkbox" checked={splitChapters} onChange={(e) => setSplitChapters(e.target.checked)} />
            <span>Split into one file per chapter</span>
          </label>
          {splitChapters && (
            <label className="field field--checkbox field--indented">
              <input type="checkbox" checked={keepOriginal} onChange={(e) => setKeepOriginal(e.target.checked)} />
              <span>Also keep the full-length file</span>
            </label>
          )}

          <div className="field-grid">
            <label className="field">
              <span>Subtitles (languages)</span>
              <input
                type="text"
                className="text-input mono"
                placeholder="en, fr"
                value={prefs.subtitles}
                onChange={(e) => set("subtitles", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Rate limit</span>
              <input
                type="text"
                className="text-input mono"
                placeholder="e.g. 2M (blank = unlimited)"
                value={prefs.rateLimit}
                onChange={(e) => set("rateLimit", e.target.value)}
              />
            </label>
          </div>
          {!isAudio && prefs.subtitles.trim() && (
            <label className="field field--checkbox">
              <input
                type="checkbox"
                checked={prefs.embedSubtitles}
                onChange={(e) => set("embedSubtitles", e.target.checked)}
              />
              <span>Embed subtitles in the video</span>
            </label>
          )}

          <label className="field">
            <span>Output template</span>
            <input
              type="text"
              className="text-input mono"
              placeholder="%(title)s [%(id)s].%(ext)s"
              value={prefs.outputTemplate}
              onChange={(e) => set("outputTemplate", e.target.value)}
              spellCheck={false}
            />
          </label>
        </details>

        {errorMsg && <p className="form-error form-error--pre">{errorMsg}</p>}

        <div className="modal__footer">
          <button type="button" className="button button--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button--primary" disabled={!canSubmit || submitting}>
            {submitting ? "Queueing…" : urls.length > 1 ? `Queue ${urls.length} downloads` : "Download"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
