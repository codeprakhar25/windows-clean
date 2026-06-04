param(
  [string]$ProfileRoot = $env:USERPROFILE,
  [int]$LargeCandidateMB = 0,
  [string]$ManifestPath = (Join-Path $env:TEMP "spaceguard-fixture-manifest.json")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-FixtureFile {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][int]$SizeMB,
    [Parameter(Mandatory = $true)][int]$AgeDays,
    [Parameter(Mandatory = $true)][string]$Purpose
  )

  $directory = Split-Path -Parent $Path
  New-Item -ItemType Directory -Path $directory -Force | Out-Null

  if (-not (Test-Path -LiteralPath $Path)) {
    $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::Read)
    try {
      $stream.SetLength([int64]$SizeMB * 1MB)
    } finally {
      $stream.Close()
    }
  }

  $item = Get-Item -LiteralPath $Path
  $item.LastWriteTime = (Get-Date).AddDays(-1 * $AgeDays)

  [PSCustomObject]@{
    path = $Path
    sizeMB = $SizeMB
    ageDays = $AgeDays
    purpose = $Purpose
  }
}

if (-not $ProfileRoot) {
  throw "ProfileRoot is required."
}

$localAppDataRoot = if ($env:LOCALAPPDATA) { $env:LOCALAPPDATA } else { Join-Path $ProfileRoot "AppData\Local" }

$records = @()
$records += New-FixtureFile -Path (Join-Path $env:TEMP "spaceguard-fixture\known-temp.tmp") -SizeMB 8 -AgeDays 14 -Purpose "known-temp-fixture"
$records += New-FixtureFile -Path (Join-Path $ProfileRoot "Downloads\spaceguard-fixture\old-tool-setup.msi") -SizeMB 16 -AgeDays 60 -Purpose "downloads-installers"
$records += New-FixtureFile -Path (Join-Path $ProfileRoot "Downloads\spaceguard-fixture\old-archive.zip") -SizeMB 12 -AgeDays 95 -Purpose "downloads-installers"
$records += New-FixtureFile -Path (Join-Path $ProfileRoot "Documents\spaceguard-protected\cache-like\keep.bin") -SizeMB 4 -AgeDays 120 -Purpose "protected-path-fixture"
$records += New-FixtureFile -Path (Join-Path $ProfileRoot "Code\spaceguard-old-app\node_modules\.spaceguard-cache.bin") -SizeMB 10 -AgeDays 110 -Purpose "review-data-fixture"
$records += New-FixtureFile -Path (Join-Path $ProfileRoot ".gradle\caches\spaceguard-fixture\cache.bin") -SizeMB 10 -AgeDays 45 -Purpose "developer-tooling-fixture"

if ($LargeCandidateMB -gt 0) {
  $records += New-FixtureFile -Path (Join-Path $ProfileRoot "Videos\spaceguard-fixture\old-export.mov") -SizeMB $LargeCandidateMB -AgeDays 120 -Purpose "large-user-files"
}

$dryRunScopeCases = @(
  [PSCustomObject]@{
    id = "windows-temp"
    title = "Known temp allowed target"
    route = "known-temp-delete"
    targetPath = "%TEMP%, C:\Windows\Temp"
    expectedTargetScopeStatus = "target-allowed"
    expectedRejectCode = ""
    minCandidateCount = 0
  },
  [PSCustomObject]@{
    id = "downloads-forbidden-as-temp"
    title = "Downloads forbidden as temp target"
    route = "known-temp-delete"
    targetPath = (Join-Path $ProfileRoot "Downloads")
    expectedTargetScopeStatus = "target-blocked"
    expectedRejectCode = "target-forbidden"
    maxCandidateCount = 0
  },
  [PSCustomObject]@{
    id = "browser-identity-forbidden"
    title = "Browser identity forbidden as cache target"
    route = "browser-cache-only"
    targetPath = (Join-Path $localAppDataRoot "Google\Chrome\User Data\Default\Cookies")
    expectedTargetScopeStatus = "target-blocked"
    expectedRejectCode = "target-forbidden"
    maxCandidateCount = 0
  }
)

$manifest = [PSCustomObject]@{
  schemaVersion = "spaceguard-fixture-manifest/v1"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  profileRoot = $ProfileRoot
  largeCandidateMB = $LargeCandidateMB
  destructiveCommands = $false
  records = $records
  dryRunScopeCases = $dryRunScopeCases
}

$manifestDirectory = Split-Path -Parent $ManifestPath
New-Item -ItemType Directory -Path $manifestDirectory -Force | Out-Null
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $ManifestPath -Encoding UTF8

Write-Host "SpaceGuard fixtures seeded."
Write-Host "Manifest: $ManifestPath"
Write-Host "No cleanup or delete command was run."
