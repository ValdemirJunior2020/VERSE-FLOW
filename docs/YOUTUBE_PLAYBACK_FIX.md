# YouTube Download Playback Fix

VerseFlow's yt-dlp importer now prefers AVC/H.264 video plus AAC audio. After download it probes the result with ffprobe. If the downloaded file uses a codec Electron may not reliably play, VerseFlow automatically creates a browser-compatible H.264/AAC MP4 using FFmpeg.

The Media **Preview** action now also switches directly to the Present preview screen so video playback is visible instead of only changing presentation state in the background.
