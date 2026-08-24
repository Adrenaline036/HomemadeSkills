[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectPath,

    [switch]$Force
)

$skillDirectoryName = 'MultiAgentProjectGuide'
$packagePath = Split-Path -Parent $PSScriptRoot
$skillFile = Join-Path $packagePath 'SKILL.md'

if (-not (Test-Path -LiteralPath $skillFile -PathType Leaf)) {
    throw "Invalid TRAE package: SKILL.md was not found at $skillFile"
}

$resolvedProject = [System.IO.Path]::GetFullPath($ProjectPath)
if (-not (Test-Path -LiteralPath $resolvedProject -PathType Container)) {
    throw "Project directory does not exist: $resolvedProject"
}

$skillsContainer = Join-Path $resolvedProject '.agents\skills'
$backupContainer = Join-Path $resolvedProject '.agents\skill-backups'
$destinationPath = Join-Path $skillsContainer $skillDirectoryName

if (Test-Path -LiteralPath $destinationPath) {
    if (-not $Force) {
        throw "Skill already exists at $destinationPath. Re-run with -Force to back it up and replace it."
    }

    New-Item -ItemType Directory -Path $backupContainer -Force | Out-Null
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backupPath = Join-Path $backupContainer "$skillDirectoryName-$stamp"
    if (Test-Path -LiteralPath $backupPath) {
        throw "Backup target already exists: $backupPath"
    }
    Move-Item -LiteralPath $destinationPath -Destination $backupPath
    Write-Output "Previous TRAE Skill moved to: $backupPath"
}

New-Item -ItemType Directory -Path $skillsContainer -Force | Out-Null
Copy-Item -LiteralPath $packagePath -Destination $destinationPath -Recurse

$installedSkill = Join-Path $destinationPath 'SKILL.md'
if (-not (Test-Path -LiteralPath $installedSkill -PathType Leaf)) {
    throw "TRAE Skill installation verification failed at $destinationPath"
}

function Get-PackageInventory {
    param([Parameter(Mandatory = $true)][string]$Root)

    Get-ChildItem -LiteralPath $Root -Recurse -File | ForEach-Object {
        [PSCustomObject]@{
            RelativePath = $_.FullName.Substring($Root.Length).TrimStart('\')
            Length       = $_.Length
            SHA256       = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
        }
    } | Sort-Object RelativePath
}

$sourceInventory = @(Get-PackageInventory -Root $packagePath)
$installedInventory = @(Get-PackageInventory -Root $destinationPath)
$inventoryDiff = @(Compare-Object $sourceInventory $installedInventory -Property RelativePath, Length, SHA256)
if ($inventoryDiff.Count -ne 0) {
    throw "TRAE Skill package verification failed with $($inventoryDiff.Count) inventory difference(s)."
}

Write-Output "Installed TRAE project Skill: $destinationPath"
Write-Output "Verified package files: $($sourceInventory.Count)"
Write-Output 'Reload TRAE, then verify the Skill in Settings -> Rule & Skills -> Skills.'
