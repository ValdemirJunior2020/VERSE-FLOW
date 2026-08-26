# VerseFlow reliability rules

VerseFlow is operated by nontechnical church volunteers. Reliability and simple controls are more important than clever features.

## Never break the live path
- Keep Bible lookup, lyrics, local images/video, local audio, Preview, LIVE, BLACK, CLEAR TEXT and display output usable offline.
- Do not require AI, cloud services, accounts, API keys or internet for the core presentation flow.
- Never rewrite Scripture text. Use the installed Bible database exactly.
- When switching from a Bible verse to another verse, or between song sections, preserve the selected background and background music unless the operator explicitly clears them.
- Treat "Use as background" differently from "Fullscreen". Applying a background must not erase verse/lyrics text.
- Treat "Add music" differently from "Play only". Adding background music must not erase verse/lyrics text.

## Error handling
- Do not expose raw stack traces to church operators unless they open diagnostics.
- Log renderer/main-process errors to the local VerseFlow error log.
- Prefer a recoverable UI state over a blank screen.
- Optional tools such as FFmpeg, mpv, Ollama, yt-dlp, OBS and Whisper must never prevent VerseFlow from starting.

## Required checks after code changes
1. Run `npm test`.
2. Run `npm run build`.
3. Run `npm run test:e2e` when Electron/Playwright is available.
4. Fix new console errors and page errors before calling the change complete.
5. Test one Bible verse with a built-in background and confirm the text remains visible.
6. Test one song section with a background and confirm the lyrics remain visible.
7. Test BLACK and CLEAR TEXT safety controls.

## UI rules
- Use plain labels that a first-time volunteer understands.
- Do not make an image click silently replace text. Offer explicit actions such as USE AS BG and FULLSCREEN.
- Do not make an audio click silently replace text. Offer ADD MUSIC and PLAY NOW.
- Keep dangerous/technical settings out of the normal Sunday flow.
