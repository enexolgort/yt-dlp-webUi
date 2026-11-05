import { useMemo, useState } from "react";
import type { MediaFormat, MediaInfo } from "../types";
import { formatBytes, formatCount, formatDuration, formatUploadDate } from "../lib/format";

interface Props {
  info: MediaInfo;
  selectedFormat: string;
  onUseFormat: (f: MediaFormat) => void;
}

function height(f: MediaFormat): number {
  const m = f.resolution?.match(/(\d+)x(\d+)/);
  return m ? Number(m[2]) : 0;
}

/** Video formats first (tallest first), then audio-only, dropping storyboards/manifests with no codecs. */
function sortFormats(formats: MediaFormat[]): MediaFormat[] {
  return formats
    .filter((f) => f.vcodec || f.acodec)
    .sort((a, b) => {
      const av = a.vcodec ? 1 : 0;
      const bv = b.vcodec ? 1 : 0;
      if (av !== bv) return bv - av;
      const dh = height(b) - height(a);
      if (dh) return dh;
      return (b.tbr ?? 0) - (a.tbr ?? 0);
    });
}

export function MediaPreview({ info, selectedFormat, onUseFormat }: Props) {
  const [showFormats, setShowFormats] = useState(false);
  const formats = useMemo(() => sortFormats(info.formats ?? []), [info.formats]);

  const facts = [
    info.channel ?? info.uploader,
    info.type === "video" ? formatDuration(info.duration) : `${info.entries?.length ?? 0} entries`,
    formatUploadDate(info.uploadDate),
    info.viewCount != null ? `${formatCount(info.viewCount)} views` : null,
    info.isLive ? "LIVE" : null,
    info.extractor,
  ].filter(Boolean);

  return (
    <div className="media-preview">
      <div className="media-preview__main">
        {info.thumbnail && (
          <img className="media-preview__thumb" src={info.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
        )}
        <div className="media-preview__text">
          <div className="media-preview__title">
            {info.type === "playlist" && <span className="pill">Playlist</span>} {info.title}
          </div>
          <div className="media-preview__facts mono">{facts.join(" · ")}</div>
        </div>
      </div>

      {info.type === "playlist" && info.entries && info.entries.length > 0 && (
        <ol className="media-preview__entries">
          {info.entries.slice(0, 8).map((e, i) => (
            <li key={e.id ?? i}>
              <span className="media-preview__entry-title">{e.title ?? e.id}</span>
              {e.duration ? <span className="mono muted">{formatDuration(e.duration)}</span> : null}
            </li>
          ))}
          {info.entries.length > 8 && <li className="muted">{"…"} and {info.entries.length - 8} more</li>}
        </ol>
      )}

      {formats.length > 0 && (
        <>
          <button type="button" className="link-button" onClick={() => setShowFormats((s) => !s)}>
            {showFormats ? "Hide" : "Pick a specific format"} ({formats.length})
          </button>
          {showFormats && (
            <div className="format-table-wrap">
              <table className="format-table mono">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Ext</th>
                    <th>Resolution</th>
                    <th>Codecs</th>
                    <th>Size</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {formats.map((f) => {
                    const selected = selectedFormat === f.formatId || selectedFormat === `${f.formatId}+ba/b`;
                    return (
                      <tr key={f.formatId} className={selected ? "format-table__row--selected" : undefined}>
                        <td>{f.formatId}</td>
                        <td>{f.ext}</td>
                        <td>
                          {f.vcodec ? (f.resolution ?? "?") : "audio"}
                          {f.fps && f.vcodec ? ` ${Math.round(f.fps)}fps` : ""}
                        </td>
                        <td className="format-table__codecs" title={[f.vcodec, f.acodec, f.note].filter(Boolean).join(" · ")}>
                          {[f.vcodec?.split(".")[0], f.acodec?.split(".")[0]].filter(Boolean).join(" + ")}
                        </td>
                        <td>{f.filesize ? formatBytes(f.filesize) : "--"}</td>
                        <td>
                          <button type="button" className="button button--ghost button--small" onClick={() => onUseFormat(f)}>
                            {selected ? "✓" : "Use"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
