# GitHub Bible Sources

VerseFlow now uses these repositories as install sources:

- `public-domain-bibles/english` for the English public-domain text files.
- `damarals/biblias` for Portuguese canonical JSON.

## English

The source repository documents three plain-text layouts (`f1`, `f2`, and `f3`).
VerseFlow stores the source filename and format for each translation and converts
the downloaded text into the local `verses` SQLite table.

Configured English translations:

- AKJV — American King James Version
- ASV — American Standard Version
- BBE — Bible in Basic English
- BISHOP — Bishops' Bible
- CPDV — Catholic Public Domain Version
- COVERDALE — Miles Coverdale Bible
- DRV — Douay-Rheims Bible Version
- DARBY — Darby Bible
- GENEVA — Geneva Bible
- KJV — King James Version
- OEB — Open English Bible (Commonwealth)
- RV — Revised Version
- JPS1917 — Tanakh in English (JPS 1917)
- TRCBV — Tyndale, Rogers, Coverdale Bible with variants
- WEB — World English Bible
- WEY — Weymouth New Testament
- WTNT — William Tyndale New Testament
- YLT — Young's Literal Translation

## Portuguese

The Portuguese repository's README marks these three with the public-domain symbol:

- ALM1911 — Almeida 1911
- TB — Tradução Brasileira
- BLIVRE — Bíblia Livre

VerseFlow uses GitHub's contents API to list each translation's canonical per-book
JSON files under `data/canonical/<CODE>/`, downloads those JSON files, converts the
chapter/verse objects, and stores the result locally.

Other Portuguese translations from that repository remain outside the automatic
download path because the repository itself says they belong to their publishers.

## Offline behavior

Internet is needed only while clicking Install for a Bible that is not already
in the local database. After import, scripture is served from VerseFlow's SQLite
database and presentation does not depend on GitHub.
