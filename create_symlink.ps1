param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string] $LinkDirectory,

    [Parameter(Mandatory = $false, Position = 1)]
    [string] $LinkName = "VimCord.plugin.js"
)

$ErrorActionPreference = "Stop"

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[ERROR] $msg" -ForegroundColor Red }

try {
    # Resolve source file within this repository
    $repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
    $source = Join-Path -Path $repoRoot -ChildPath "VimCord.plugin.js"

    if (!(Test-Path -LiteralPath $source)) {
        throw "Source file not found: $source"
    }

    # Validate destination directory
    if (!(Test-Path -LiteralPath $LinkDirectory)) {
        throw "Link directory does not exist: $LinkDirectory"
    }

    # Compose link path
    $linkPath = Join-Path -Path $LinkDirectory -ChildPath $LinkName

    if (Test-Path -LiteralPath $linkPath) {
        throw "Link path already exists: $linkPath"
    }

    Write-Info "Creating symbolic link"
    Write-Info "  Target: $source"
    Write-Info "  Link:   $linkPath"

    # Create the symbolic link
    New-Item -ItemType SymbolicLink -Path $linkPath -Target $source | Out-Null

    Write-Host "Symbolic link created successfully:" -ForegroundColor Green
    Write-Host "  $linkPath -> $source" -ForegroundColor Green

    Write-Info "To verify, open the link and edit; changes will reflect in the target immediately."
    Write-Info "Note: On Windows, creating symlinks may require Administrator privileges or Developer Mode to be enabled."
}
catch {
    Write-Err $_
    Write-Warn "If you see an access/privilege error, try one of the following:" 
    Write-Host "  1) Run PowerShell as Administrator and re-run this script." -ForegroundColor Yellow
    Write-Host "  2) Enable Windows Developer Mode: Settings > Privacy & Security > For developers > Developer Mode (On)." -ForegroundColor Yellow
    exit 1
}