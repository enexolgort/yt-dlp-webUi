# yt-dlp UI

A web UI for the [`yt-dlp-api`](https://github.com/enexolgort/yt-dlp-API)
backend (the Express/TypeScript wrapper around yt-dlp), built against the
`openapi.yaml` it provides. React + Vite + TypeScript, runs as its own small
server/process alongside that API. Sister project of
[transmission-webUi](https://github.com/enexolgort/transmission-webUi), with
the same look, structure and deployment.

This project is made specifically to be used with
[enexolgort/yt-dlp-API](https://github.com/enexolgort/yt-dlp-API). It
assumes that backend's endpoints and behavior.

## Features

- **Download list** polling `GET /downloads` (every 1.5s while something is
  active, 5s when idle): progress bar, status, speed, ETA, size, playlist
  position (`item 3/12`), and yt-dlp's error message for failed jobs. Filter
  by title/URL and by status (all / active / completed / failed).
- **Add downloads**: paste one URL, or several (one per line, each becomes
  its own job).
  - Video (quality presets ≤2160p…480p, container mp4/mkv/webm/mov) or
    audio only (convert to mp3/m4a/opus/flac/wav/aac/vorbis).
  - **Inspect** a URL before downloading (`GET /info`): thumbnail, title,
    channel, duration, upload date, views. For playlists it shows the entry
    list and turns on "Whole playlist" for you. You can also pick an exact
    format from yt-dlp's format list. Video-only formats get `+ba/b` added
    so the result has sound.
  - Embed thumbnail/metadata, whole playlist and item ranges (`1-5,8`).
  - Custom tags (title, artist, album, album artist, genre, date, track,
    composer, comment).
  - Split by chapters (optionally keeping the full file), subtitles (plus
    embedding), rate limit, output template, or a raw `-f` format selector.
  - The form remembers your last type/quality/container/embed choices
    (per browser, in `localStorage`).
- **Paste anywhere**: pasting a link anywhere on the page (outside a text
  field) opens the add dialog with it filled in. `?url=<link>` in the
  address does the same, so a bookmarklet can send the current page here:

  ```js
  javascript:location.href='http://<ui-host>:4174/?url='+encodeURIComponent(location.href)
  ```

- **Per-job actions**: cancel (keeps partial files), retry failed/cancelled
  jobs with the same options, save files to your device (one click for a
  single file, a picker for playlists/chapters), push to SFTP, remove (with
  optional "also delete files from disk").
- **SFTP push** (`POST /downloads/:id/push-sftp`) with live byte progress.
  Quick-pick destination folders are editable in Settings, and you can type
  any other folder when pushing. The **Transfers** tab lists every transfer
  (`GET /transfers`).
- **Settings & yt-dlp**: connection (API base URL + optional API key,
  stored per browser), installed yt-dlp version, and one-click
  `POST /ytdlp/update` on the stable/nightly/master channel with its output.

## Requirements

- Docker (recommended), **or** Node.js 18+ to run it directly
- The [`yt-dlp-api`](https://github.com/enexolgort/yt-dlp-API) backend
  already running somewhere reachable.

## Run with Docker (recommended)

The included `Dockerfile` builds the app and serves the static output with
nginx, so the host needs only Docker, not Node.js.

```bash
docker compose up -d --build
```

This publishes port **`4174`** on all of the host's interfaces, so it's
reachable at `http://<host-tailscale-ip-or-name>:4174` from any device on
your tailnet. It's one port above transmission-ui's `4173` so both can run
on the same box.

Without compose:

```bash
docker build -t yt-dlp-ui .
docker run -d --name yt-dlp-ui -p 4174:80 --restart unless-stopped yt-dlp-ui
```

The API base URL and key are set at runtime in the browser, so the same
image works for everyone without rebuilding or passing environment variables.

## Run directly with Node (alternative)

```bash
npm install
npm run dev        # dev server, http://<this-machine>:5174, hot reload
# or
npm run build      # production build to dist/
npm run start      # serve the production build, http://<this-machine>:4174
```

Both bind to `0.0.0.0` (see `vite.config.ts`), so they're reachable from
other devices on your tailnet.

On first load, go to **Settings & yt-dlp** and set:

- **API base URL**: where `yt-dlp-api` is reachable *from the browser you're
  using*, e.g. `http://my-server:3000` or `http://100.x.y.z:3000` from
  another tailnet device (`http://localhost:3000` only works on the API's
  own machine).
- **API key**: only if you've set `API_KEY` on the backend.

Use **Test connection** to check the values you typed before saving. It
checks the key too, not just that the server answers.

## Notes on API behavior

- **CORS**: the API already calls `app.use(cors())`, which allows any origin
  and the `X-API-Key` header, so no backend changes are needed.
- **No `/stats` endpoint**: the counters above the list (speed, active,
  queued…) are computed from the job list.
- **No stored title**: the API doesn't save the media title on a job, so a
  job shows the URL until yt-dlp reports a title (or a file exists). Custom
  `metadata.title` is shown when set.
- **Saving files with an API key**: a plain link can't carry the
  `X-API-Key` header. With a key set, the UI downloads the file into the
  browser first and then saves it, which is slow for very large files.
  Without a key it's a normal streamed download.
- **Removing a job without deleting files** leaves the files on disk, but
  the API forgets the job, so this UI can no longer list, save or push
  them. For completed jobs the remove dialog keeps files by default. For
  failed/cancelled ones it deletes them by default.
- **State is in memory on the API**: restarting it clears the job and
  transfer lists (files on disk stay).

## Project structure

```
Dockerfile                  Multi-stage build: node (build) -> nginx (serve)
nginx.conf                  nginx config for the built static app
docker-compose.yml
openapi.yaml                Copy of the backend's spec this UI is built against
src/
  types.ts                  Types mirroring openapi.yaml schemas
  lib/
    api.ts                  Typed fetch client for every endpoint (+ file saving)
    settings.ts             localStorage: base URL, API key, SFTP quick-picks
    preferences.ts          Remembered add-dialog choices, quality -> -f mapping
    SettingsContext.tsx     React context exposing settings + the API client
    ToastContext.tsx        Lightweight notifications
    format.ts               Bytes/speed/ETA/duration formatting, status meta, job titles
  hooks/
    useDownloads.ts         Polls GET /downloads (adaptive interval)
    useTransfers.ts         Polls GET /transfers
    useInterval.ts          Polling helper, pauses on hidden tabs
  components/
    AddDownloadDialog.tsx   The add form
    MediaPreview.tsx        Inspect result + format picker
    DownloadTable.tsx / DownloadRow.tsx
    FilesDialog.tsx, PushSftpDialog.tsx, ConfirmRemoveDialog.tsx
    TransfersPanel.tsx, SettingsPanel.tsx, StatsBar.tsx, ...
```
