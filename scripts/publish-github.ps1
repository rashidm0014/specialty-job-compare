# Publish Specialty Job Compare to GitHub + enable Pages
# Prerequisites: GitHub CLI logged in (gh auth login)

$ErrorActionPreference = "Stop"
$RepoName = "specialty-job-compare"

$ghDir = "C:\Program Files\GitHub CLI"
if (Test-Path "$ghDir\gh.exe") {
  $env:Path = "$ghDir;" + $env:Path
}

function Get-Gh {
  $cmd = Get-Command gh -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  if (Test-Path "$ghDir\gh.exe") { return "$ghDir\gh.exe" }
  return $null
}

$gh = Get-Gh
if (-not $gh) {
  Write-Error "Install GitHub CLI: winget install GitHub.cli"
}

& $gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Log in to GitHub first:"
  & $gh auth login -h github.com -p https -w
}

Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (git rev-parse --is-inside-work-tree 2>$null)) {
  git init -b main
  git add -A
  git commit -m "Initial release: Specialty Job Compare PWA"
}

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"
$remote = git remote get-url origin
$ErrorActionPreference = $prevEap

if (-not $remote) {
  Write-Host "Creating GitHub repo: $RepoName ..."
  & $gh repo create $RepoName --public --source=. --remote=origin --description "Physician job offer comparison PWA by specialty"
  if ($LASTEXITCODE -ne 0) { throw "gh repo create failed (exit $LASTEXITCODE)" }
}

Write-Host "Pushing to origin/main ..."
git push -u origin main
if ($LASTEXITCODE -ne 0) { throw "git push failed (exit $LASTEXITCODE)" }

$user = (& $gh api user --jq .login 2>$null)
if ($user) {
  Write-Host ""
  Write-Host "Repo: https://github.com/$user/$RepoName"
}

Write-Host ""
Write-Host "Enable GitHub Pages (one-time):"
Write-Host "  Repo -> Settings -> Pages -> Build and deployment -> Source: GitHub Actions"
Write-Host ""
Write-Host "After the deploy workflow finishes, open:"
if ($user) {
  Write-Host "  https://$user.github.io/$RepoName/"
} else {
  Write-Host "  https://<your-username>.github.io/$RepoName/"
}
Write-Host ""
Write-Host "Install on phone: open that URL in Safari (iOS) or Chrome (Android) -> Add to Home Screen / Install app"
