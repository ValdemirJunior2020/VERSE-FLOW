# VerseFlow Smart Presenter

Smart Presenter is optional and local. The default model is `qwen3:0.6b` through Ollama at `127.0.0.1:11434`.

The AI produces a small action plan. It does not write Scripture. When a Bible reference is requested, VerseFlow looks up the exact verse from its installed local Bible database.

If Ollama or the model is unavailable, common commands still use a deterministic fallback parser.

`yt-dlp` is optional and is installed to `%LOCALAPPDATA%\VerseFlowTools\yt-dlp.exe`. The Media tab can save a single permitted web-media URL into VerseFlow's user-data media folder. This is intended only for content the user owns or has permission to download; it does not bypass DRM or grant media rights.
