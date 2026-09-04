[CmdletBinding()]
param(
    [string]$CodexHome = (Join-Path $env:USERPROFILE '.codex')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$sourceRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$mcpRoot = [IO.Path]::GetFullPath((Join-Path $CodexHome 'mcp'))
$destination = [IO.Path]::GetFullPath((Join-Path $mcpRoot 'deepseek-review-worker'))
$backupRoot = [IO.Path]::GetFullPath((Join-Path $mcpRoot 'backups'))
$pending = [IO.Path]::GetFullPath((Join-Path $mcpRoot ('.deepseek-review-worker.pending-{0}' -f [Guid]::NewGuid().ToString('N'))))
$node = (Get-Command node.exe -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$sourceFiles = @('review-core.mjs', 'generation-registry.mjs', 'review-server.mjs', 'invoke-tool.mjs', 'package.json', 'package-lock.json')

function Assert-ChildPath([string]$Child, [string]$Parent, [string]$Label) {
    $prefix = $Parent.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if (-not $Child.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "$Label escaped its intended parent: $Child" }
}

Assert-ChildPath $destination $mcpRoot 'Destination'
Assert-ChildPath $pending $mcpRoot 'Pending package'
foreach ($name in $sourceFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot $name) -PathType Leaf)) { throw "Missing source file: $name" }
}

$testFiles = @(Get-ChildItem -LiteralPath (Join-Path $sourceRoot 'test') -File -Filter '*.test.mjs' | Sort-Object Name | Select-Object -ExpandProperty FullName)
if ($testFiles.Count -eq 0) { throw 'No source contract tests were found.' }
& $node --test $testFiles
if ($LASTEXITCODE -ne 0) { throw 'Source contract tests failed.' }

New-Item -ItemType Directory -Path $pending -Force | Out-Null
$backup = $null
$installMode = 'directory-replace'
$activeInPlaceStarted = $false
try {
    foreach ($name in $sourceFiles) { Copy-Item -LiteralPath (Join-Path $sourceRoot $name) -Destination (Join-Path $pending $name) }
    & $npm ci --omit=dev --ignore-scripts --no-audit --no-fund --prefix $pending
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed for the pending MCP worker.' }
    & $node --check (Join-Path $pending 'review-server.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'Pending MCP server syntax validation failed.' }
    foreach ($name in $sourceFiles) {
        $sourceHash = (Get-FileHash -LiteralPath (Join-Path $sourceRoot $name) -Algorithm SHA256).Hash
        $pendingHash = (Get-FileHash -LiteralPath (Join-Path $pending $name) -Algorithm SHA256).Hash
        if ($sourceHash -ne $pendingHash) { throw "Pending source hash mismatch: $name" }
    }
    if (Test-Path -LiteralPath $destination -PathType Container) {
        New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $backup = [IO.Path]::GetFullPath((Join-Path $backupRoot ("deepseek-review-worker-$stamp-{0}" -f [Guid]::NewGuid().ToString('N').Substring(0, 8))))
        Assert-ChildPath $backup $backupRoot 'Backup'
        try {
            Move-Item -LiteralPath $destination -Destination $backup
        } catch [IO.IOException] {
            $installedLock = Join-Path $destination 'package-lock.json'
            $pendingLock = Join-Path $pending 'package-lock.json'
            if (-not (Test-Path -LiteralPath $installedLock -PathType Leaf)) { throw }
            $installedLockHash = (Get-FileHash -LiteralPath $installedLock -Algorithm SHA256).Hash
            $pendingLockHash = (Get-FileHash -LiteralPath $pendingLock -Algorithm SHA256).Hash
            if ($installedLockHash -ne $pendingLockHash) {
                throw 'The active MCP directory is locked and dependencies changed. Close/restart Codex, then rerun the installer.'
            }
            Copy-Item -LiteralPath $destination -Destination $backup -Recurse
            $installMode = 'active-in-place-source-replace'
        }
    }
    if ($installMode -eq 'directory-replace') {
        Move-Item -LiteralPath $pending -Destination $destination
    } else {
        $activeInPlaceStarted = $true
        foreach ($name in $sourceFiles) {
            $target = Join-Path $destination $name
            $temporaryTarget = Join-Path $destination ('.{0}.pending-{1}' -f $name, [Guid]::NewGuid().ToString('N'))
            Assert-ChildPath $temporaryTarget $destination 'Temporary source file'
            Copy-Item -LiteralPath (Join-Path $pending $name) -Destination $temporaryTarget
            Move-Item -LiteralPath $temporaryTarget -Destination $target -Force
        }
        Remove-Item -LiteralPath $pending -Recurse -Force
    }
    $installedInventory = foreach ($name in $sourceFiles) {
        [PSCustomObject]@{
            RelativePath = $name
            Length = (Get-Item -LiteralPath (Join-Path $destination $name)).Length
            SHA256 = (Get-FileHash -LiteralPath (Join-Path $destination $name) -Algorithm SHA256).Hash
        }
    }
    $sourceInventory = foreach ($name in $sourceFiles) {
        [PSCustomObject]@{
            RelativePath = $name
            Length = (Get-Item -LiteralPath (Join-Path $sourceRoot $name)).Length
            SHA256 = (Get-FileHash -LiteralPath (Join-Path $sourceRoot $name) -Algorithm SHA256).Hash
        }
    }
    $installedDiff = @(Compare-Object $sourceInventory $installedInventory -Property RelativePath, Length, SHA256)
    if ($installedDiff.Count -ne 0) { throw "Installed source verification failed with $($installedDiff.Count) difference(s)." }
} catch {
    if (Test-Path -LiteralPath $pending) { Write-Warning "Pending package retained for diagnosis: $pending" }
    if ($backup -and (Test-Path -LiteralPath $backup)) {
        if ($activeInPlaceStarted -and (Test-Path -LiteralPath $destination)) {
            foreach ($name in $sourceFiles) {
                $backupFile = Join-Path $backup $name
                if (Test-Path -LiteralPath $backupFile -PathType Leaf) { Copy-Item -LiteralPath $backupFile -Destination (Join-Path $destination $name) -Force }
            }
        } elseif (-not (Test-Path -LiteralPath $destination)) {
            Move-Item -LiteralPath $backup -Destination $destination
            $backup = $null
        }
    }
    throw
}

if ($backup) { Write-Output "Previous MCP worker backup retained at: $backup" }
Write-Output "Installed DeepSeek review MCP worker: $destination"
Write-Output "Install mode: $installMode"
Write-Output 'Restart Codex App or reconnect the MCP server before normal interactive use.'
