# Holy Family Funeral Mass Planning

A static SPA for reviewing funeral Mass readings and hymns before completing the official parish planning form.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The app is configured with a relative Vite base path so the `dist` output can be deployed from GitHub Pages.

## Content Sources

- Form option labels were extracted from the public Holy Family OSV form.
- Scripture text is from the World English Bible Catholic edition, published by eBible.org as public domain text.
- Hymn actions open YouTube search results; no YouTube API key is required.

## Family Vote Backend

The app can submit final choices to a Google Sheet through a Google Apps Script web app.

1. Create a Google Sheet.
2. In the Sheet, open `Extensions > Apps Script`. Do not create a standalone Apps Script project.
3. Paste `google-apps-script/Code.gs` into the Apps Script editor.
4. In Project Settings, enable `Show "appsscript.json" manifest file in editor`.
5. Paste `google-apps-script/appsscript.json` into the manifest file.
6. Deploy it with `Deploy > New deployment > Web app`.
7. Set `Execute as` to yourself and `Who has access` to anyone with the link.
8. Copy the web-app URL into `public/votes-config.json` as the `endpoint` value.

The GitHub Pages app only sees the public Apps Script URL. The Sheet and vote aggregation stay in Apps Script. The manifest uses the `spreadsheets.currentonly` scope so the script can access only the spreadsheet it is attached to.
