# YouTube Error 153 Fix

YouTube Error 153 means the embedded player did not receive the HTTP Referer
(or equivalent API client identification) required by YouTube.

VerseFlow is an Electron desktop app loaded from local files, so Chromium may
not naturally send a useful Referer to YouTube.

This build:
- adds an Electron webRequest hook for YouTube/Google video requests
- sends `Referer: https://verseflow.app/`
- sends `Origin: https://verseflow.app`
- sets `referrerPolicy="strict-origin-when-cross-origin"` on YouTube iframes
- includes `origin` and `widget_referrer` player parameters

This does not bypass YouTube advertising, account restrictions, or videos whose
owners disabled embedding.
