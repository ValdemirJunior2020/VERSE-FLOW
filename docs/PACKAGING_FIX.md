# Bible Catalog Packaging Fix

The Electron main process must be able to read the Bible catalog after the app is packaged into app.asar.

This build keeps the runtime catalog at:

`electron/bible-catalog.json`

`electron/**/*` is already part of the electron-builder file list, so the catalog is always included with the main process.

The source catalog also remains at:

`src/data/bible-catalog.json`

and `package.json` now explicitly packages `src/data/**/*` as a second layer of protection.

Do not change `electron/main.cjs` back to requiring `../src/data/bible-catalog.json`.
