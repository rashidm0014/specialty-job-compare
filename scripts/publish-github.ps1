# Publish Specialty Job Compare to GitHub + enable Pages
# Prerequisites: GitHub CLI logged in (gh auth login)

$ErrorActionPreference = "Stop"
$RepoName = "specialty-job-compare"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "Install GitHub CLI: winget install GitHub.cli"
}

gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Log in to GitHub first:"
  gh auth login -h github.com -p https -w
}

Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (git rev-parse --is-inside-work-tree 2>$null)) {
  git init -b main
  git add -A
  git commit -m "Initial release: Specialty Job Compare PWA"
}

$remote = git remote get-url origin 2>$null
if (-not $remote) {
  gh repo create $RepoName --public --source=. --remote=origin --description "Physician job offer comparison PWA by specialty"
  git push -u origin main
} else {
  git push -u origin main
}

Write-Host ""
Write-Host "Enable GitHub Pages (one-time):"
Write-Host "  Repo -> Settings -> Pages -> Build and deployment -> Source: GitHub Actions"
Write-Host ""
Write-Host "After the deploy workflow finishes, open:"
Write-Host "  https://<your-username>.github.io/$RepoName/"
Write-Host ""
Write-Host "Install on phone: open that URL in Safari (iOS) or Chrome (Android) -> Add to Home Screen / Install app"
