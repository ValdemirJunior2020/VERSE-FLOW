# Bible Install Fix

The previous build tried to parse the large plain-text files from
`public-domain-bibles/english` at runtime. The repository documents f1/f2/f3
layouts, but the first parser implementation did not correctly recognize the
f2 rows and could return "0 verses detected".

This build disables that broken automatic parser.

Automatic installs now use clean full-Bible JSON for:
- AKJV
- ASV
- BBE
- KJV
- DRV / Douay-Rheims
- WEB

Portuguese automatic installs remain connected to `damarals/biblias`:
- ALM1911
- TB
- BLIVRE

The remaining English public-domain titles stay visible in the Bible Library,
but are marked Import until their text parser/download mapping is verified.
They will no longer show an Install button that fails.

After a successful install, VerseFlow saves the verses in its local SQLite
database and does not need internet to present them.
