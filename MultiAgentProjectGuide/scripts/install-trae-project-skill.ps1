[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectPath,

    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$skillDirectoryName = 'MultiAgentProjectGuide'
$packagePath = [IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$skillFile = Join-Path $packagePath 'SKILL.md'

if (-not (Test-Path -LiteralPath $skillFile -PathType Leaf)) {
    throw "Invalid project Skill package: SKILL.md was not found at $skillFile"
}

$resolvedProject = [IO.Path]::GetFullPath($ProjectPath)
if (-not (Test-Path -LiteralPath $resolvedProject -PathType Container)) {
    throw "Project directory does not exist: $resolvedProject"
}

$skillsContainer = [IO.Path]::GetFullPath((Join-Path $resolvedProject '.agents\skills'))
$backupContainer = [IO.Path]::GetFullPath((Join-Path $resolvedProject '.agents\skill-backups'))
$destinationPath = [IO.Path]::GetFullPath((Join-Path $skillsContainer $skillDirectoryName))
$pendingPath = [IO.Path]::GetFullPath((Join-Path $skillsContainer ('.{0}.pending-{1}' -f $skillDirectoryName, [Guid]::NewGuid().ToString('N'))))

function Assert-ChildPath {
    param(
        [Parameter(Mandatory = $true)][string]$Child,
        [Parameter(Mandatory = $true)][string]$Parent,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $prefix = $Parent.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if (-not $Child.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "$Label escaped its intended parent: $Child"
    }
}

Assert-ChildPath -Child $skillsContainer -Parent $resolvedProject -Label 'Skills container'
Assert-ChildPath -Child $backupContainer -Parent $resolvedProject -Label 'Backup container'
Assert-ChildPath -Child $destinationPath -Parent $skillsContainer -Label 'Destination'
Assert-ChildPath -Child $pendingPath -Parent $skillsContainer -Label 'Pending package'

if ((Test-Path -LiteralPath $destinationPath) -and -not $Force) {
    throw "Skill already exists at $destinationPath. Re-run with -Force to stage, verify, back it up, and replace it."
}

function Get-PackageInventory {
    param([Parameter(Mandatory = $true)][string]$Root)

    Get-ChildItem -LiteralPath $Root -Recurse -File |
        Where-Object { $_.FullName -notmatch '[\\/]__pycache__[\\/]|\.pyc$' } |
        ForEach-Object {
            [PSCustomObject]@{
                RelativePath = $_.FullName.Substring($Root.Length).TrimStart('\')
                Length       = $_.Length
                SHA256       = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
            }
        } | Sort-Object RelativePath
}

$sourceInventory = @(Get-PackageInventory -Root $packagePath)
if ($sourceInventory.Count -eq 0) { throw 'The source Skill package is empty.' }

if ($Force -and (Test-Path -LiteralPath $destinationPath -PathType Container)) {
    $currentInventory = @(Get-PackageInventory -Root $destinationPath)
    $currentDiff = @(Compare-Object $sourceInventory $currentInventory -Property RelativePath, Length, SHA256)
    if ($currentDiff.Count -eq 0) {
        Write-Output "Project Skill is already current: $destinationPath"
        Write-Output "Verified package files: $($sourceInventory.Count)"
        Write-Output 'No backup or replacement was created.'
        exit 0
    }
}

New-Item -ItemType Directory -Path $skillsContainer -Force | Out-Null
Copy-Item -LiteralPath $packagePath -Destination $pendingPath -Recurse

$pendingInventory = @(Get-PackageInventory -Root $pendingPath)
$pendingDiff = @(Compare-Object $sourceInventory $pendingInventory -Property RelativePath, Length, SHA256)
if ($pendingDiff.Count -ne 0) {
    throw "Pending Skill verification failed with $($pendingDiff.Count) inventory difference(s). Existing installation was not changed. Pending evidence remains at $pendingPath"
}

$backupPath = $null
if (Test-Path -LiteralPath $destinationPath) {
    New-Item -ItemType Directory -Path $backupContainer -Force | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backupPath = [IO.Path]::GetFullPath((Join-Path $backupContainer ("$skillDirectoryName-$stamp-{0}" -f [Guid]::NewGuid().ToString('N').Substring(0, 8))))
    Assert-ChildPath -Child $backupPath -Parent $backupContainer -Label 'Backup target'
    if (Test-Path -LiteralPath $backupPath) { throw "Backup target already exists: $backupPath" }
    Move-Item -LiteralPath $destinationPath -Destination $backupPath
}

try {
    Move-Item -LiteralPath $pendingPath -Destination $destinationPath
    $installedInventory = @(Get-PackageInventory -Root $destinationPath)
    $inventoryDiff = @(Compare-Object $sourceInventory $installedInventory -Property RelativePath, Length, SHA256)
    if ($inventoryDiff.Count -ne 0) {
        throw "Installed Skill package verification failed with $($inventoryDiff.Count) inventory difference(s)."
    }
} catch {
    $failedPath = [IO.Path]::GetFullPath((Join-Path $skillsContainer ('.{0}.failed-{1}' -f $skillDirectoryName, [Guid]::NewGuid().ToString('N'))))
    Assert-ChildPath -Child $failedPath -Parent $skillsContainer -Label 'Failed package target'
    if (Test-Path -LiteralPath $destinationPath) {
        Move-Item -LiteralPath $destinationPath -Destination $failedPath
    }
    if ($backupPath -and (Test-Path -LiteralPath $backupPath)) {
        Move-Item -LiteralPath $backupPath -Destination $destinationPath
    }
    throw
}

if ($backupPath) { Write-Output "Previous project Skill moved to: $backupPath" }
Write-Output "Installed project Skill: $destinationPath"
Write-Output "Verified package files: $($sourceInventory.Count)"
Write-Output 'Reload the agent host, then verify the Skill in its Rules/Skills UI when applicable.'
