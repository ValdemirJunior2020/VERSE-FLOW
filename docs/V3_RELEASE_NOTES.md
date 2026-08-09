# VerseFlow V3 — Multilingual Production Center

## Operator workflow
- Free Live Desk remains the primary workflow: Text, Bible, Songs, Media, YouTube, Smart, Lower Third and Timer.
- Service Builder remains optional.
- Persistent Quick Bar provides Black, Logo, Clear Text, Bible, Songs, Media, YouTube, Timer, Lower Third, Production, Camera, Stop Audio, Previous, Live and Next.

## Languages
- English default.
- One-click Brazilian Portuguese using the supplied Brazilian flag.
- One-click Spanish.
- Language is remembered locally.
- Scripture, lyrics and live/user content are explicitly excluded from automatic UI translation.

## Open-source production tools
- mpv fullscreen playback + IPC controls.
- FFmpeg/ffprobe diagnostics and compatible MP4 creation.
- whisper.cpp offline captions and safe preview-only Auto Scripture Follow.
- OBS Studio / obs-websocket scene, recording and stream control, plus Open OBS.
- HyperFrames Motion Studio and render-to-Media workflow.
- Bitfocus Companion localhost-only HTTP action API for Stream Deck/hardware workflows.
- Ollama qwen3:0.6b Smart Presenter with deterministic fallback.
- yt-dlp permitted web-media import with Deno runtime support.

## Reliability work
- 18 complete offline Genesis-to-Revelation Bible editions retained.
- Strong's markers stay out of normal presentation text.
- YouTube renderer uses a localhost HTTP origin/referrer architecture.
- Local images/video/audio use a secure `verseflow-media://` streaming protocol so media stays usable with webSecurity enabled.
- Windows installer closes stale VerseFlow/Electron processes and automatically uses a timestamped release directory if an old release folder is locked.
- No optional production tool is required for normal Bible/song/media/text presenting.

## Validation in build workspace
- `electron/main.cjs`, `electron/preload.cjs`, and `electron/production-tools.cjs` pass `node --check`.
- TypeScript/TSX syntax scan reports no TS1xxx parser diagnostics.
- Static regression checks verify the 18 bundled Bibles, multilingual flags/default, production IPC actions, HyperFrames composition metadata, Smart actions, local media protocol and yt-dlp/Deno installer wiring.
- The full npm/Vitest/Vite/Electron Windows build must still be run on the target Windows PC because this build workspace does not contain the project's npm dependencies.
