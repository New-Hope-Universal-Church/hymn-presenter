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
- ✏️ Password-protected hymn editor — create, edit, reorder and delete verses
- ☁️ Cloud database via Supabase — edits are live for everyone instantly
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

### Managing Hymns (Password Required)

Click **Hymn Editor** in the header — you will be prompted for the editor password. Only authorised users can access the editor.

Once unlocked you can:

- **Add a new hymn book** — click the `+` button next to HYMN BOOKS
- **Add a new hymn** — select a book, then click **+ Add Hymn**
- **Edit a hymn's details** — select a hymn and click **Edit Info**
- **Add or edit verses** — select a hymn, then click any verse or **+ Add Verse**
- **Reorder verses** — use the ↑ ↓ Move buttons in the edit form
- **Delete a verse or hymn** — use the Delete button in the edit form

All changes are saved directly to the cloud and reflected on all devices immediately.

### Syncing the Database

Go to **Help → Check for Database Updates** to manually pull the latest hymns from the cloud. This is useful mid-session if another operator has made changes on a different device.

---

## For Developers — Project Setup

### Prerequisites

- [Node.js](https://nodejs.org) v18 or higher
- [Git](https://git-scm.com)
- A [Supabase](https://supabase.com) project with the tables set up (see below)

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
│   ├── database.js          # Supabase client + local SQLite cache
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
├── editor/
│   ├── editor.html          # Hymn editor UI
│   ├── editor.css           # Editor styles
│   └── editor.js            # CRUD logic for books, hymns and verses
│
└── assets/
    ├── images/              # App logo and images
    └── icons/               # Window icons (.ico, .icns)
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | [Electron](https://electronjs.org) v40 |
| Cloud database | [Supabase](https://supabase.com) (PostgreSQL) |
| Offline cache | [SQLite](https://sqlite.org) via [sql.js](https://sql-js.github.io/sql.js/) |
| Auto-updates | [electron-updater](https://www.electron.build/auto-update) |
| Build & packaging | [electron-builder](https://www.electron.build) |
| UI | Vanilla HTML, CSS, JavaScript |
| Fonts | Cinzel, Inter (Google Fonts) |

---

## Database Architecture

The app uses a two-layer database strategy:

```
Supabase (PostgreSQL) ← single source of truth
       ↓ synced on startup
Local SQLite cache (AppData) ← used during service
       ↑ writes go to Supabase first, then cache
```

**On startup:** the app loads from the local cache immediately so it is usable right away, then syncs the latest data from Supabase in the background.

**When editing:** all changes write directly to Supabase and update the local cache. Every device gets the change on their next startup or manual sync.

**Offline:** if there is no internet, the app falls back to the local cache. No hymns are lost.

### Supabase Table Schema

```sql
books (
  id    bigint primary key,
  name  text not null unique
)

hymns (
  id       bigint primary key,
  number   integer not null,
  title    text not null,
  author   text,
  book_id  bigint references books(id)
)

hymn_blocks (
  id        bigint primary key,
  hymn_id   bigint references hymns(id) on delete cascade,
  position  integer not null default 0,
  type      text not null default 'verse',
  label     text not null,
  text      text not null
)
```

### Setting Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the schema SQL above in the **SQL Editor**
3. Enable Row Level Security:

```sql
alter table books       enable row level security;
alter table hymns       enable row level security;
alter table hymn_blocks enable row level security;

create policy "Public read"   on books       for select using (true);
create policy "Public read"   on hymns       for select using (true);
create policy "Public read"   on hymn_blocks for select using (true);
create policy "Service write" on books       for all    using (true);
create policy "Service write" on hymns       for all    using (true);
create policy "Service write" on hymn_blocks for all    using (true);
```

4. Copy your **Project URL** and **service_role key** from Project Settings → API into `data/database.js`

---

## Editor Password

The hymn editor is password-protected. Only users with the password can add, edit or delete hymns. The editor unlocks for the session and locks again when the app restarts.

To change the password, generate a new SHA-256 hash and replace `EDITOR_PASSWORD_HASH` in `main.js`:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('yournewpassword').digest('hex'))"
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