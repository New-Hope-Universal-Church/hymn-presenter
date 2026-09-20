# NHUC Hymn Projector

A dual-monitor hymn projection desktop app built for **New Hope Universal Church (NHUC)**. The operator controls which verse is displayed from their laptop, while the congregation sees a clean fullscreen display on the projector.

![Electron](https://img.shields.io/badge/Electron-40.x-47848F?logo=electron&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows&logoColor=white)
![License](https://img.shields.io/badge/License-Private-red)

---

## Features

- 🎵 984 Methodist hymns, fully searchable by number or title
- 📖 Multi-book support — add and manage multiple hymn collections
- 🖥️ Dual-monitor projection — operator view on laptop, fullscreen on projector
- ✏️ One-click link to the hymn import page, where lyrics are corrected
- ☁️ Hymns are served by the NHUC lyrics API — corrections reach every device on its next sync
- 📦 Offline support — local cache keeps the app working without internet
- 🔤 Live font size control for the projection screen
- ⌨️ Keyboard navigation during service
- 🔄 Auto-update notifications via GitHub Releases

---

## For Church Staff — Installing the App

1. Go to the [Releases page](../../releases) of this repository
2. Download the latest **NHUC Hymn Projector Setup x.x.x.exe** file
3. Run the installer and follow the prompts
4. Launch **NHUC Hymn Projector** from your desktop or Start Menu

> **Tip:** Connect your projector before opening the app. It will automatically detect the second screen and open the projection window on it.

---

## For Church Staff — Using the App

### During a Service

| Action | How |
|--------|-----|
| Search for a hymn | Type the hymn number or title in the search bar |
| Filter by hymn book | Use the dropdown above the search bar |
| Project a verse | Click the verse in the right panel |
| Navigate verses | Arrow keys ← → on your keyboard |
| Blank the screen | Press **B** or click the Blank button |
| Change text size | Click **A−** or **A+** in the header |
| Open projection window | Click **Open Projection** in the header |

### Fixing Hymns

Click **Import Hymns** in the header, or press **Ctrl+E**. The lyrics import page opens in your web browser and asks for
your name and password. Paste a hymn from the Methodist Hymn Book app, check the preview, and save. This app never sees
those credentials and cannot change hymns itself.

### Syncing the Database

Hymns download automatically the first time the app opens, and the app checks for changes each time it starts. Go to **Help → Check for Database Updates** to check right away, for example after a correction was made on the import page. If nothing changed, nothing is downloaded.

---

## For Developers — Project Setup

### Prerequisites

- [Node.js](https://nodejs.org) v18 or higher
- [Git](https://git-scm.com)
- The URL and read-only key of the NHUC lyrics API (see below)

### Clone and Install

```bash
git clone https://github.com/New-Hope-Universal-Church/hymn-presenter.git
cd hymn-presenter
npm install
```

### Run in Development

```bash
npm start
```

---

## Project Structure

```
nhuc-hymns/
├── main.js                  # Electron main process — windows, IPC, auth
├── preload.js               # Secure bridge between main and renderer
├── package.json             # Dependencies and build config
│
├── data/
│   ├── api.js               # Read-only client for the lyrics API
│   ├── database.js          # Local SQLite cache + sync
│   └── db-sync.js           # Manual sync trigger (Help menu)
│
├── operator/
│   ├── index.html           # Operator control panel UI
│   ├── operator.css         # Operator panel styles
│   └── operator.js          # Search, projection, auth, sync logic
│
├── projection/
│   ├── projection.html      # Fullscreen congregation display
│   ├── projection.css       # Projection screen styles
│   └── projection.js        # Receives and displays verse blocks
│
└── assets/
    ├── images/              # App logo and images
    └── icons/               # Window icons (.ico, .icns)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | [Electron](https://electronjs.org) v40 |
| Hymn source | NHUC lyrics API (`/v1/snapshot`) |
| Offline cache | [SQLite](https://sqlite.org) via [sql.js](https://sql-js.github.io/sql.js/) |
| Auto-updates | [electron-updater](https://www.electron.build/auto-update) |
| Build & packaging | [electron-builder](https://www.electron.build) |
| UI | Vanilla HTML, CSS, JavaScript |
| Fonts | Cinzel, Inter (Google Fonts) |

---

## Database Architecture

```
NHUC lyrics API ← single source of truth
       ↓ synced on startup, only when the version changed
Local SQLite cache (AppData) ← used during service
```

**On startup:** the app loads from the local cache immediately so it is usable right away, then asks the API for the
dataset in the background. The app sends the version it already has. If nothing changed, the API answers with an
empty 304 and nothing is downloaded. If something changed, the app downloads the full dataset and replaces its cache,
so deleted hymns disappear too.

**Offline:** if the API cannot be reached, the app keeps using the local cache. No hymns are lost.

**Fixing lyrics:** hymns are corrected on the lyrics API's import page, not in this app. Changes reach every device on
its next start or when someone clicks Help → Check for Database Updates.

### Data shape

The API sends, and the local cache stores, three tables. Every id is a UUID, so data from separate databases can be
merged without clashes. The hymn number people see is its own column.

```sql
books (
  id     uuid primary key,
  name   text not null unique,
  alias  text
)

hymns (
  id       uuid primary key,
  number   integer not null,
  title    text not null,
  author   text,
  book_id  uuid references books(id)
)

hymn_blocks (
  id        uuid primary key,
  hymn_id   uuid references hymns(id) on delete cascade,
  position  integer not null,
  type      text not null,   -- verse, refrain, chorus or bridge
  label     text not null,
  text      text not null
)
```

### Lyrics API settings

The app needs the API address and a read-only key. Copy `data/api-config.example.json` to `data/api-config.json`
and fill it in, or set `LYRICS_API_URL` and `LYRICS_API_KEY`. The file is not committed. It has to exist on the
machine that runs `npm run build`, because the installer includes it. The key can only read, but treat it like a
password anyway, since anyone can extract it from an installed app. If it leaks, remove it from the server and issue a
new one with the next release.

### Tests

```bash
npm test
```

---

## Building the .exe Installer

### 1. Bump the version in `package.json`

```json
"version": "1.1.0"
```

### 2. Build

```bash
npm run build
```

Output in `dist/`:

```
dist/
├── NHUC Hymn Projector Setup 1.1.0.exe
└── latest.yml
```

---

## Publishing a GitHub Release

1. Commit and push:

```bash
git add .
git commit -m "Release v1.1.0"
git push
```

2. Go to GitHub → **Releases** → **Draft a new release**
3. Set the tag to `v1.1.0` (the `v` prefix is required)
4. Upload both files from `dist/`:
   - `NHUC Hymn Projector Setup 1.1.0.exe`
   - `latest.yml` ← required for auto-updates
5. Click **Publish release**

Users will see an update notification bar the next time they open the app.

---

## License

This software is private and proprietary. It is built exclusively for New Hope Universal Church (NHUC), Ghana. Redistribution, modification, or use outside of NHUC is not permitted without explicit written permission from the author.

---

## Author

**Aaron Katey Kudadjie**
Built for New Hope Universal Church, Ghana 🇬🇭