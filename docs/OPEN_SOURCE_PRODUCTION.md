# VerseFlow Open-Source Production Center

VerseFlow keeps its core Bible/song/image/video presentation engine offline and independent. The Production page adds optional tools when a church wants more capability.

## mpv
Professional local media playback. VerseFlow launches selected local media fullscreen on the chosen Windows display and controls pause/resume, seek and stop through mpv's JSON IPC named pipe.

## FFmpeg / ffprobe
Use **Probe Media** to inspect codecs/resolution/duration. Use **Make Compatible Copy** to create an H.264/AAC MP4 in the VerseFlow data directory and add it to Media.

## whisper.cpp
**Start Captions** listens to the default microphone locally. Choose Auto, English, Portuguese or Spanish. **Auto Scripture Follow** is intentionally preview-only: a spoken reference can prepare an exact locally stored Bible verse, but it never automatically sends Scripture live.

## OBS Studio / obs-websocket
Click **Open OBS**, then in OBS open **Tools → WebSocket Server Settings**. Keep authentication enabled, copy the password into VerseFlow, and connect on the default v5 port 4455. VerseFlow can choose program scenes and start/stop recording or streaming.

Motion Studio creates a local 1920×1080  composition. **Open Motion Studio** previews it; **Render Motion** renders MP4 and automatically adds the result to VerseFlow Media.  requires Node.js 22+ and FFmpeg.

## Bitfocus Companion / Stream Deck
VerseFlow exposes a localhost-only HTTP control surface on `http://127.0.0.1:35677`. Use the displayed action URLs for Companion buttons: black, clear, logo, empty, live, next and previous. The server is intentionally loopback-only, not exposed to the internet.

## Ollama Smart Presenter
The optional lightweight local model is `qwen3:0.6b`. Smart Presenter creates safe action plans for local content. It is not allowed to rewrite Scripture: VerseFlow resolves Bible references against the installed local Bible database. Rule-based commands still work if Ollama is unavailable.

## yt-dlp + Deno
Web-media import is only for content the operator owns or is permitted to download. VerseFlow does not bypass DRM or grant content rights. Deno is installed because current yt-dlp YouTube extraction uses an external JavaScript runtime for full support. FFmpeg is recommended for merging/post-processing.

## Reliability rule
Do not make any optional tool a dependency of normal Sunday presentation. If an optional integration is missing, Bible, songs, local media, custom text, timers, lower thirds and audience/stage output must continue working.
