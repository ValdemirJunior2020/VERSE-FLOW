# VerseFlow Sunday-Safe Debugging

## For church operators
Use the app normally. If the top bar says **CHECK SYSTEM**, open **Settings** and press **Run System Check**. VerseFlow saves technical errors to a local log so the operator does not need PowerShell.

Backgrounds and music are intentionally separate from fullscreen media. **USE AS BG** keeps the current Bible verse or lyrics. **FULLSCREEN** presents the image/video by itself. **ADD MUSIC** keeps the current text and adds audio. **PLAY NOW** plays the audio by itself.

## For the developer
Cline project rules are stored in `.clinerules/verseflow.md`. They tell the coding agent to preserve the offline live path and run tests after changes.

`INSTALL_VERSEFLOW.bat --check` runs Vitest, the Vite production build, and the Playwright Electron flow. The Playwright test opens the real Electron application, verifies all 12 built-in backgrounds are present, confirms changing a background does not erase slide text, and runs the in-app System Check.

FFmpeg remains optional. Use the existing Media Doctor when a local video is incompatible. VerseFlow core presentation must still launch when FFmpeg is absent.
