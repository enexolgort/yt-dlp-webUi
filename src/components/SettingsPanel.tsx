import { useCallback, useEffect, useState } from "react";
import { useSettings } from "../lib/SettingsContext";
import { useToast } from "../lib/ToastContext";
import { ApiClient } from "../lib/api";
import type { SftpDestination } from "../lib/settings";

const CHANNELS = ["stable", "nightly", "master"];

export function SettingsPanel() {
  const { settings, updateSettings, api } = useSettings();
  const { notify } = useToast();

  // ---------------------------------------------------------------- connection
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [testing, setTesting] = useState(false);
  const dirty = baseUrl !== settings.baseUrl || apiKey !== settings.apiKey;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    updateSettings({ ...settings, baseUrl, apiKey });
    notify("Connection settings saved", "success");
  }

  // Tests what's typed in the form, not what's saved, so you can check before saving.
  async function handleTest() {
    setTesting(true);
    try {
      const client = new ApiClient({ baseUrl: baseUrl.trim().replace(/\/+$/, ""), apiKey: apiKey.trim() });
      const health = await client.health();
      // /health is public even with API_KEY set, so hit a protected endpoint to check the key too.
      await client.listDownloads();
      notify(`Connected · yt-dlp ${health.ytdlp ?? "?"}`, "success");
    } catch (err) {
      notify((err as Error).message);
    } finally {
      setTesting(false);
    }
  }

  // ---------------------------------------------------------------- yt-dlp
  const [version, setVersion] = useState<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [channel, setChannel] = useState("stable");
  const [updating, setUpdating] = useState(false);
  const [updateOutput, setUpdateOutput] = useState<string | null>(null);

  const loadVersion = useCallback(() => {
    setVersionError(null);
    api
      .health()
      .then((h) => setVersion(h.ytdlp ?? null))
      .catch((err: Error) => {
        setVersion(null);
        setVersionError(err.message);
      });
  }, [api]);

  useEffect(() => {
    loadVersion();
  }, [loadVersion]);

  async function handleUpdate() {
    setUpdating(true);
    setUpdateOutput(null);
    try {
      const res = await api.updateYtdlp(channel);
      setVersion(res.version);
      setUpdateOutput(res.output || "(no output)");
      notify(`yt-dlp is now ${res.version}`, "success");
    } catch (err) {
      setUpdateOutput((err as Error).message);
      notify((err as Error).message);
    } finally {
      setUpdating(false);
    }
  }

  // ---------------------------------------------------------------- SFTP destinations
  const [destinations, setDestinations] = useState<SftpDestination[]>(settings.sftpDestinations);
  const destDirty = JSON.stringify(destinations) !== JSON.stringify(settings.sftpDestinations);

  const editDest = (i: number, patch: Partial<SftpDestination>) =>
    setDestinations((list) => list.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  function saveDestinations() {
    updateSettings({ ...settings, sftpDestinations: destinations });
    // Reflect normalisation (trimmed, empty rows dropped)
    setDestinations(
      destinations.map((d) => ({ label: d.label.trim(), remoteFolder: d.remoteFolder.trim() })).filter((d) => d.remoteFolder),
    );
    notify("Destinations saved", "success");
  }

  return (
    <div className="settings-panel">
      <section className="card">
        <h2>Connection</h2>
        <p className="muted">
          Points this UI at your yt-dlp-api instance. Stored locally in this browser, so each device on your Tailnet
          configures its own connection.
        </p>
        <form onSubmit={handleSave} className="settings-form">
          <label className="field">
            <span>API base URL</span>
            <input
              type="text"
              className="text-input"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="http://localhost:3000"
            />
          </label>
          <label className="field">
            <span>API key (optional)</span>
            <input
              type="password"
              className="text-input"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Only needed if API_KEY is set on the server"
              autoComplete="off"
            />
          </label>
          <div className="settings-form__actions">
            <button type="button" className="button button--ghost" onClick={handleTest} disabled={testing}>
              {testing ? "Testing…" : "Test connection"}
            </button>
            <button type="submit" className="button button--primary" disabled={!dirty}>
              Save
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="card__header-row">
          <h2>yt-dlp</h2>
          <a className="link-button" href={api.docsUrl()} target="_blank" rel="noreferrer">
            API docs {"↗"}
          </a>
        </div>
        <dl className="kv">
          <div>
            <dt>Installed version</dt>
            <dd className="mono">
              {version ?? (versionError ? <span className="form-error">{versionError}</span> : "…")}
            </dd>
          </div>
        </dl>
        <p className="muted">
          Sites change often; updating yt-dlp fixes most sudden extraction errors. Works with the standalone binary
          (the API's Docker image); pip installs have to be updated with pip.
        </p>
        <div className="inline-form">
          <select className="select" value={channel} onChange={(e) => setChannel(e.target.value)} aria-label="Channel">
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button type="button" className="button button--ghost" onClick={handleUpdate} disabled={updating}>
            {updating ? "Updating… (can take a minute)" : "Update yt-dlp"}
          </button>
          <button type="button" className="button button--ghost" onClick={loadVersion} disabled={updating}>
            Recheck
          </button>
        </div>
        {updateOutput && <pre className="output-block">{updateOutput}</pre>}
      </section>

      <section className="card">
        <div className="card__header-row">
          <h2>SFTP destinations</h2>
          <button
            type="button"
            className="button button--ghost button--small"
            onClick={() => setDestinations((l) => [...l, { label: "", remoteFolder: "" }])}
          >
            + Add
          </button>
        </div>
        <p className="muted">
          Quick-pick folders in the "Push to remote" dialog. The SFTP server itself is configured on the API
          (SFTP_HOST, SFTP_USERNAME, key file).
        </p>
        <div className="dest-editor">
          {destinations.length === 0 && <p className="muted small">No quick-picks; you can still type a folder when pushing.</p>}
          {destinations.map((d, i) => (
            <div key={i} className="dest-editor__row">
              <input
                type="text"
                className="text-input"
                placeholder="Label"
                value={d.label}
                onChange={(e) => editDest(i, { label: e.target.value })}
                aria-label="Label"
              />
              <input
                type="text"
                className="text-input mono"
                placeholder="/remote/folder"
                value={d.remoteFolder}
                onChange={(e) => editDest(i, { remoteFolder: e.target.value })}
                aria-label="Remote folder"
              />
              <button
                type="button"
                className="icon-button icon-button--danger"
                title="Remove"
                onClick={() => setDestinations((l) => l.filter((_, j) => j !== i))}
              >
                {"✕"}
              </button>
            </div>
          ))}
        </div>
        <div className="settings-form__actions">
          <button type="button" className="button button--primary" onClick={saveDestinations} disabled={!destDirty}>
            Save destinations
          </button>
        </div>
      </section>
    </div>
  );
}
