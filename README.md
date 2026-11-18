# FamTree

A local web app for a family tree with Hebrew/English names, spouses, parents and dates. Node.js + Express, data in a single JSON file.

## Setup

```bash
npm install
cp .env.example .env      # optional: port, API token, data location
npm start                 # http://127.0.0.1:5003
```

It is also started by `..\dashboard\start-all.bat` together with the other apps.

## Data (never committed)

| Setting       | Default        | Notes |
| ------------- | -------------- | ----- |
| `DATA_FILE`   | `members.json` | Created on the first save; a missing file just means "start empty". |
| `BACKUP_DIR`  | `backups/`     | Timestamped backups (on startup and periodically). |
| `API_TOKEN`   | random per run | Sent by the UI on writes; the page receives it from the server, so it never lives in the source. |

All of these are git-ignored, as is `.env`. Shape of `members.json`:

```json
[{ "uuid": "…", "name": "…", "gender": "male", "father": "<uuid>", "mother": "<uuid>", "spouses": ["<uuid>"], "birthdate": "1950-01-31", "afterShkia": false, "hebrewNickname": "…", "englishNickname": "…", "notes": "" }]
```

Files ending in `.depr` are no longer used and will be deleted; they are git-ignored.
