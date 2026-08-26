VERSEFLOW V2 — SMART WINDOWS CHURCH PRESENTER

ROLE
Act as a senior Windows desktop engineer, live-production UX designer, Electron/React/TypeScript architect, and church presentation workflow specialist. Build VerseFlow as a dependable, offline-first Windows presenter that is fast enough to operate during a live worship service without forcing the operator to pre-build a service.

MISSION
VerseFlow should help a church present Scripture, songs, custom text, images, local videos, audio, and permitted web media with clarity, reverence, speed, and reliability. The operator must be able to move from an idea to Preview to Live in seconds. Service/playlist planning must remain optional.

NON-NEGOTIABLE LIVE SAFETY
1. Preview and Live are separate states. Content never reaches the audience merely because it was selected or edited.
2. Keep persistent emergency controls: Black, Clear Text, Logo, Empty Screen, Freeze, Previous, Next.
3. All audience output is exact 16:9 with safe margins.
4. Output windows are separate Electron BrowserWindows on operator-selected Windows displays.
5. contextIsolation=true and nodeIntegration=false. All OS access goes through a narrow preload IPC bridge.
6. Core Bible/song/media presentation works with no internet and no AI.
7. AI can select and format actions, but must NEVER rewrite, paraphrase, summarize, correct, or invent Bible text. For Scripture, AI returns only a reference/translation; VerseFlow retrieves exact text from the local Bible database.
8. If AI or web tools fail, the operator can still present normally.

PRIMARY WORKSPACE — LIVE DESK
Create immediate tabs for:
- Text: type anything, preview, Live Now.
- Bible: Translation → Book → Chapter → Verse/search; Preview and Live per verse.
- Songs: local song library with Verse/Chorus/Bridge section buttons, Preview and Live.
- Media: import images/videos/audio freely, Preview/Live without a service, plus optional permitted web-media import.
- YouTube: official embedded preview/presentation where supported.
- Smart: natural-language local presentation assistant.

SMART PRESENTER
Use Ollama on localhost with qwen3:0.6b as the lightweight default model. AI is optional. Supported safe action plans include SHOW_VERSE, SHOW_TEXT, BLACK, CLEAR_TEXT, LOGO, SET_TEXT_COLOR, SET_ACCENT_COLOR, FIND_SONG, FIND_MEDIA, and NO_ACTION. Show the plan before execution and provide Preview Action and Send Live buttons. Add deterministic rule-based fallbacks for common commands if Ollama is absent.

Examples:
- “Show John 3:16” → locate exact installed verse; never generate its wording.
- “Make the verse text pink” → change theme textColor.
- “Show our welcome video” → locate local media by name and preview it.
- “Black screen” → activate safety blackout.

OPTIONAL OPEN-SOURCE TOOLS
Provide INSTALL_OPTIONAL_OPEN_SOURCE_TOOLS.bat with:
- Ollama official Windows installation.
- Pull qwen3:0.6b (~523 MB model) as the lightweight Smart Presenter model.
- Download official Windows yt-dlp.exe into %LOCALAPPDATA%\VerseFlowTools.
- Status/update options.
No optional tool may be required for VerseFlow core.

YT-DLP RULES
Use yt-dlp only as an optional importer for media the operator owns or is permitted to save. Do not describe it as an ad-removal or DRM-bypass feature. Do not bypass DRM. Use --no-playlist by default and download a single playable file to VerseFlow's local user-data media folder.

BIBLE
Bundle/import full Genesis→Revelation translations where supplied. Bible UI should not default to “John 3”; default to Translation + Book + Chapter navigation. Strong's-number editions may keep Strong's data in storage but hide {G####}/{H####} markers from normal presentation text by default.

SONGS
Songs are local and user-managed. Support title, author, CCLI metadata, key, and named sections. CCLI metadata does not grant licensing rights. Allow each section to Preview/Live immediately; playlist addition remains optional.

MEDIA
Allow images, videos, and audio to be imported at any time. Generate reliable local paths. Support Preview and Live directly. Keep video playback controls and volume/mute/seek controls.

COLORS/THEMES
Operator UI: light beige main background, off-white panels/input areas, charcoal text/icons, gold active buttons/accents, red LIVE indicators. Font family, font size, text color, reference/accent color, alignment, overlay, and transition must all actually affect preview and audience output. Never let CSS !important override live color controls.

TOP TOOLBAR — EVERY CONTROL MUST WORK
- Global Search: Enter searches exact Bible refs/verse text, songs, then media and opens a preview.
- New Slide: creates a blank preview slide and opens Live Desk.
- Import: context-aware; Bible JSON on Bible page, otherwise media picker.
- Undo: restores the previous presentation state as Preview.
- Present: opens Live Desk.
- READY/LIVE indicator reflects real state.

WINDOWS PACKAGING
Maintain INSTALL_VERSEFLOW.bat and DEV_VERSEFLOW.bat. Use portable Node 22 LTS when needed. electron-builder creates NSIS installer and portable EXE. Bundle Bible JSON correctly. Package optional-tools BAT as an extraResource. Avoid native Node modules where possible; use sql.js SQLite.

QUALITY BAR
No decorative dead buttons. Each visible action must either work or be deliberately disabled with a reason. Add regression tests for critical wiring: Bible packaging, live presentation state, Smart Presenter IPC, top toolbar actions, YouTube presentation wiring, and full bundled Bible coverage. Prioritize reliable live operation over experimental features.
