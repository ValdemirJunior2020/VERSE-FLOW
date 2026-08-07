# VerseFlow

VerseFlow is an offline-first Windows church presentation app built with Electron + React + Vite. The operator controls the service from one window while a separate borderless fullscreen window shows only approved live content to the congregation. A third window can be used as a stage display.

## Fastest Windows setup

1. Extract the ZIP to a normal folder such as `C:\VerseFlow`.
2. Double-click `INSTALL_VERSEFLOW.bat`.
3. The script downloads the latest Node.js 22 LTS x64 portable ZIP directly from `nodejs.org/dist`, stores it under `.runtime\node`, installs npm packages from `https://registry.npmjs.org/`, runs tests, and builds Windows artifacts.
4. Open `release\`.
5. Use the NSIS installer for a normal install or the Portable EXE for a no-install launch.

No global Node.js, Git, Python, Visual Studio, or admin install is required by the VerseFlow source bootstrap.

For source/development mode, double-click `DEV_VERSEFLOW.bat`.

## Core V1 workflow

Open **Settings**, choose the audience display and optionally the stage display, and open each output. Build a service from **Bible**, **Songs**, and **Media**. Select an item to preview it. Nothing is sent to the audience by selection alone. Press **GO LIVE** or **Send Live** to change the audience display.

Present-mode keys: `Space` / `Right Arrow` next, `Left Arrow` previous, `B` black screen, `C` clear text, `Esc` emergency black.

## Offline data

VerseFlow uses a local SQLite database powered by `sql.js` (SQLite compiled to WebAssembly). This avoids native compiler dependencies on clean Windows PCs. The database is stored in Electron's per-user application-data directory. Imported media remains on disk and VerseFlow stores paths/metadata.

The bundled Bible content is a tiny **World English Bible public-domain development sample only**. Use a licensed/public-domain source for real church deployment. The V1 schema is designed for imported translations, and scripture rendering never sends text to an AI model.

## Reliability boundaries

Core scripture/song/static-media output has no network dependency. Optional AI and video tools are not loaded by the live engine. Missing integrations do not block Present mode.

Video files use Chromium's built-in playback. FFmpeg is not bundled in this V1. HyperFrames requires FFmpeg separately.

## Security

Electron uses `contextIsolation: true` and `nodeIntegration: false`. Renderer access is limited to the preload bridge. Database commands are entity-whitelisted; renderer code cannot execute arbitrary SQL.

## Data backup

Settings → Data & backup exports the local SQLite database. Restore replaces the current local database after the operator selects a backup file.

## Build commands

```text
npm run dev
npm test
npm run build
npm run dist:win
```

See `docs/OPEN_SOURCE_INTEGRATIONS.md` and `docs/ARCHITECTURE.md`.

## Bible Library

Open **Bible → Bibles**. This build uses the English + Portuguese Bible catalog supplied for VerseFlow.

Portuguese choices include **Almeida**, **Almeida 1819**, **Almeida 1911**, **Tradução Brasileira**, **Bíblia Livre**, plus the existing **NVI local-import slot**. English public-domain choices remain available as well.

Translations with a verified download mapping show **Install**. The others show **Import** until a full-text JSON source is provided. Installed/imported Bibles are stored locally and work offline.

See `bibles/TRANSLATION_STATUS.md`.

## GitHub Bible Sources

The Bible Library can now install public-domain English translations directly from
`public-domain-bibles/english` and the public-domain Portuguese translations
ALM1911, TB and BLIVRE from `damarals/biblias`. After installation they are stored
locally for offline presentation.

See `docs/GITHUB_BIBLE_SOURCES.md`.


## Free Live Mode

VerseFlow no longer requires a service/playlist before presenting.

Open **Live Desk** to:
- type any custom text and send it live immediately
- search any loaded Bible verse and press LIVE
- click any imported image/video and send it live
- use Black, Clear Text, Logo or Empty Screen at any time
- change theme/properties without building a service

Service Builder remains available as an optional workflow for planned Sundays.
