# VerseFlow Architecture

## Processes

**Electron main process** owns windows, monitor discovery, file dialogs, the SQLite/WASM database, backup/restore, and optional integration health checks.

**Control renderer** is the operator UI. It can preview content locally without affecting the audience. It sends a serializable `PresentationState` only after a live action.

**Audience renderer** is a borderless fullscreen BrowserWindow on the selected monitor. It has no editor controls.

**Stage renderer** is a distinct fullscreen BrowserWindow showing current/next, reference, clock and notes.

## Presentation safety

The selected item is converted to `mode: preview`. Sending live creates `mode: live` and broadcasts that immutable serializable state through Electron IPC. Black, clear-text and logo are explicit state flags. Freeze prevents the output renderer from adopting subsequent state until released.

## Crash recovery

The local database is persisted after writes. Missing media paths do not corrupt service data. Output windows can be reopened from Settings at any time if a projector disconnects/reconnects.

## V1 database

`verses` holds imported scripture text. `objects` stores JSON payloads for songs, media metadata, services and themes. This keeps migrations simple while still using an actual local SQLite file.

## Next hardening steps

For deployment beyond a single church: add translation import validation, schema migrations with version numbers, file-watch media relinking, automatic service autosave, FFmpeg probing, packaged app smoke tests on Windows, code signing, and optional output-window watchdog/reconnect.
