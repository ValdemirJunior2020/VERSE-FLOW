# VerseFlow

VerseFlow is an offline-first Windows church presentation app built with Electron + React + Vite. The operator controls the service from one window while a separate borderless fullscreen window shows only approved live content to the congregation. A third window can be used as a stage display.

## Fastest Windows setup

1. Extract the ZIP to a normal folder such as `C:\VerseFlow`.
2. Double-click `INSTALL_VERSEFLOW.bat`.
3. The script downloads the latest Node.js 22 LTS x64 portable ZIP directly from `nodejs.org/dist`, stores it under `.runtime\node`, installs npm packages from `https://registry.npmjs.org/`, runs tests, and builds Windows artifacts.
4. Open `release\`.
5. Use the NSIS installer for a normal install or the Portable EXE for a no-install launch.

No global Node.js, Git, Python, Visual Studio, or admin install is required by the VerseFlow source bootstrap.

For source/development mode, double-click `INSTALL_VERSEFLOW.bat --dev`.

## Core V1 workflow

Open **Settings**, choose the audience display and optionally the stage display, and open each output. Build a service from **Bible**, **Songs**, and **Media**. Select an item to preview it. Nothing is sent to the audience by selection alone. Press **GO LIVE** or **Send Live** to change the audience display.

Present-mode keys: `Space` / `Right Arrow` next, `Left Arrow` previous, `B` black screen, `C` clear text, `Esc` emergency black.

## Offline data

VerseFlow uses a local SQLite database powered by `sql.js` (SQLite compiled to WebAssembly). This avoids native compiler dependencies on clean Windows PCs. The database is stored in Electron's per-user application-data directory. Imported media remains on disk and VerseFlow stores paths/metadata.

The bundled Bible content is a tiny **World English Bible public-domain development sample only**. Use a licensed/public-domain source for real church deployment. The V1 schema is designed for imported translations, and scripture rendering never sends text to an AI model.

## Reliability boundaries

Core scripture/song/static-media output has no network dependency. Optional AI and video tools are not loaded by the live engine. Missing integrations do not block Present mode.

Video files use Chromium's built-in playback. FFmpeg remains an optional local production dependency.

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


## Live Media and YouTube

Live Desk includes Text, Bible, Songs, Media and YouTube tabs.

Songs can be created and saved locally, with each section available for Preview or Live.
Images, videos and audio can be imported freely into the local media library.
Images and videos can be sent live without building a service.
YouTube links open inside VerseFlow using the standard embedded player.
YouTube advertising is controlled by YouTube and is not bypassed by VerseFlow.
Text color and reference/accent color can be changed with color pickers in Properties.

## Full offline Bible pack

VerseFlow now ships with 18 user-supplied complete Genesis-to-Revelation Bible editions across English, Portuguese, Spanish and Hebrew. Open Bible → Bibles and click Install. These bundled editions do not require internet access.


## Smart Presenter (optional local AI)

Run `INSTALL_VERSEFLOW.bat` to install Ollama with the lightweight `qwen3:0.6b` model and/or the official Windows `yt-dlp.exe`. Live Desk has a Smart tab with safe Preview/Live action planning. AI never rewrites Scripture; Bible text always comes from the local VerseFlow Bible database.

The top toolbar Search, New Slide, Import, and Undo controls are functional in this build. Bible now has Translation → Book → Chapter navigation and direct Preview/LIVE buttons.


## VerseFlow V3 — Multilingual Production Center

English remains the default interface. The top toolbar includes one-click English, Brazilian Portuguese and Spanish language controls, including the supplied Brazilian flag image.

Production Control integrates optional mpv, FFmpeg, whisper.cpp, OBS Studio/obs-websocket, Bitfocus Companion, Ollama and yt-dlp + Deno. Live Desk includes custom text, full offline Bibles, songs, images/video/audio, YouTube, Smart Presenter, lower thirds and timers. A persistent Quick Bar keeps emergency/live controls available.

Auto Scripture Follow is preview-only and resolves exact locally stored Scripture. Optional integrations never become a dependency of the core presentation engine.
