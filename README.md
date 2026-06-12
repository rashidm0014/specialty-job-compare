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
$env:Path = "C:\Program Files\GitHub CLI;" + $env:Path
gh auth login -h github.com -p https -w
.\scripts\publish-github.ps1
```

If `gh` is still not found, use the full path:

```powershell
& "C:\Program Files\GitHub CLI\gh.exe" auth login -h github.com -p https -w
.\scripts\publish-github.ps1
```

### Enable the live site (pick one)

**Option A — simplest (recommended if you don’t see “GitHub Actions”)**

1. Open: https://github.com/rashidm0014/specialty-job-compare/settings/pages  
2. Left sidebar → **Pages** (under “Code and automation”)  
3. **Source** → **Deploy from a branch**  
4. Branch **main**, folder **/ (root)** → **Save**  
5. Wait ~2 minutes. Site: https://rashidm0014.github.io/specialty-job-compare/

**Option B — GitHub Actions**

Same **Pages** screen → **Source** → **GitHub Actions** (then re-run the failed workflow in the **Actions** tab).

If you don’t see **Pages** in the left sidebar: click **Settings** on the repo (gear icon), scroll the left menu — it’s below **Actions**.

## License

Personal use / bring-your-own benchmark data. Not legal, tax, or employment advice.
