[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectPath,

    [switch]$Force
)

$skillDirectoryName = 'FontsReader'
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
New-Item -ItemType Directory -Path $destinationPath | Out-Null
$sourcePrefix = $packagePath.TrimEnd('\') + '\'
Get-ChildItem -LiteralPath $packagePath -Recurse -File |
    Where-Object {
        $_.Extension -ne '.pyc' -and
        $_.FullName -notmatch '[\\/]__pycache__[\\/]'
    } |
    ForEach-Object {
        $relativePath = $_.FullName.Substring($sourcePrefix.Length)
        $targetFile = Join-Path $destinationPath $relativePath
        $targetParent = Split-Path -Parent $targetFile
        New-Item -ItemType Directory -Path $targetParent -Force | Out-Null
        Copy-Item -LiteralPath $_.FullName -Destination $targetFile
    }

$installedSkill = Join-Path $destinationPath 'SKILL.md'
if (-not (Test-Path -LiteralPath $installedSkill -PathType Leaf)) {
    throw "TRAE Skill installation verification failed at $destinationPath"
}

$sourceHash = (Get-FileHash -LiteralPath $skillFile -Algorithm SHA256).Hash
$installedHash = (Get-FileHash -LiteralPath $installedSkill -Algorithm SHA256).Hash
if ($sourceHash -ne $installedHash) {
    throw 'TRAE Skill hash verification failed.'
}

Write-Output "Installed TRAE project Skill: $destinationPath"
Write-Output 'Reload TRAE, then verify the Skill in Settings -> Rule & Skills -> Skills.'
