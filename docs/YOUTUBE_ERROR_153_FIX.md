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


## Startup correction

A previous build defined `configureYouTubeRequestIdentity()` but did not invoke it
because its `app.whenReady().then(async()=>{` formatting did not match the patch
pattern. This build explicitly calls the function at the beginning of the
Electron ready block and includes a regression test for the startup call.
