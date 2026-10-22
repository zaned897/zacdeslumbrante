# Instala el entorno de desarrollo en Windows 10/11 (nativo, sin WSL).
# Ejecutar en PowerShell normal (no admin):
#   Set-ExecutionPolicy -Scope Process Bypass; .\scripts\windows-bootstrap.ps1
# Es idempotente: lo ya instalado se salta.

$ErrorActionPreference = 'Continue'
function Ok($m)   { Write-Host "  [ok] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "  [!]  $m" -ForegroundColor Yellow }
function Has($c)  { [bool](Get-Command $c -ErrorAction SilentlyContinue) }

function WingetInstall($id, $cmd, $manual) {
  if ($cmd -and (Has $cmd)) { Ok "$cmd ya instalado"; return }
  winget install --id $id -e --accept-source-agreements --accept-package-agreements --silent | Out-Null
  if ($LASTEXITCODE -eq 0) { Ok "$id instalado" } else { Warn "$id no se pudo instalar con winget. Manual: $manual" }
}

Write-Host "1. Herramientas base (winget)"
if (-not (Has 'winget')) { Warn 'winget no existe: instala "App Installer" desde Microsoft Store y vuelve a correr'; exit 1 }
WingetInstall 'Git.Git'           'git'  'https://git-scm.com/download/win'
WingetInstall 'OpenJS.NodeJS.LTS' 'node' 'https://nodejs.org'
WingetInstall 'GitHub.cli'        'gh'   'https://cli.github.com'
WingetInstall 'astral-sh.uv'      'uv'   'https://docs.astral.sh/uv/'
WingetInstall 'Oven-sh.Bun'       'bun'  'https://bun.sh'
WingetInstall 'Warp.Warp'         $null  'https://www.warp.dev/download'

# Refrescar PATH en esta sesión
$env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')

Write-Host "2. Agentes"
if (Has 'claude') { Ok 'Claude Code ya instalado' } else { irm https://claude.ai/install.ps1 | iex; Ok 'Claude Code instalado (se actualiza solo)' }
if (Has 'codex')  { Ok 'Codex ya instalado' }       else { npm install -g @openai/codex; Ok 'Codex instalado' }
Warn 'Antigravity: descarga el instalador de Windows desde antigravity.google'

Write-Host "3. Git para trabajo multiplataforma"
git config --global core.autocrlf false        # .gitattributes del repo decide los finales de línea
git config --global core.longpaths true        # rutas largas de node_modules
git config --global core.symlinks true         # skills compartidas por symlink
git config --global init.defaultBranch main
git config --global pull.rebase true
git config --global fetch.prune true
Ok 'git configurado'

Write-Host "4. Pendientes manuales"
$dev = (Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock' -ErrorAction SilentlyContinue).AllowDevelopmentWithoutDevLicense
if ($dev -eq 1) { Ok 'Modo desarrollador activo (symlinks sin admin)' }
else { Warn 'Activa Configuración > Sistema > Para programadores > Modo de desarrollador (necesario para symlinks)' }
Warn 'Cierra y abre la terminal para que el PATH nuevo aplique'
Warn 'Luego en Warp (Git Bash): claude (login) · codex login · gh auth login'
