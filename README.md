# Specialty Job Compare

Compare physician job offers by specialty — compensation, benchmarks, contract diligence, APP supervision, quality bonuses, and negotiation reports. Works offline as a Progressive Web App (PWA).

## Live app

After GitHub Pages is enabled, open:

`https://<your-github-username>.github.io/specialty-job-compare/`

## Install on your phone

**iPhone (Safari)**

1. Open the live URL in Safari.
2. Tap **Share** → **Add to Home Screen**.
3. Launch from the home screen icon (standalone, no browser chrome).

**Android (Chrome)**

1. Open the live URL in Chrome.
2. Tap the menu → **Install app** or **Add to Home screen** (or use the **Install app** button on the home screen when offered).
3. Open from your app drawer like any installed app.

HTTPS is required for install and offline mode — GitHub Pages provides this automatically.

## Local development

```bash
npm run serve
```

Open `http://localhost:8765` and hard-refresh after changes (`Ctrl+Shift+R`).

```bash
npm test
```

## Publish to GitHub (one-time)

From PowerShell in this folder:

```powershell
gh auth login -h github.com -p https -w
.\scripts\publish-github.ps1
```

Then in the new GitHub repo: **Settings → Pages → Build and deployment → Source** → **GitHub Actions**.

The workflow runs automatically on every push to `main`.

## License

Personal use / bring-your-own benchmark data. Not legal, tax, or employment advice.
