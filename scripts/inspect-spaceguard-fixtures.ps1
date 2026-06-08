param(
  [string]$ManifestPath = (Join-Path $env:TEMP "spaceguard-fixture-manifest.json"),
  [string]$EvidencePath = (Join-Path $env:TEMP "spaceguard-fixture-evidence.json"),
  [string]$AfterCleanupRoute = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ManifestPath)) {
  throw "Fixture manifest was not found: $ManifestPath"
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$records = @()
$afterCleanupRouteClean = $AfterCleanupRoute.Trim()

if ($afterCleanupRouteClean -and $afterCleanupRouteClean -ne "known-temp-delete") {
  throw "Unsupported after-cleanup route: $AfterCleanupRoute"
}

function Get-JsonValue {
  param(
    [Parameter(Mandatory = $true)]$Object,
    [Parameter(Mandatory = $true)][string[]]$Names,
    $Default = $null
  )

  foreach ($name in $Names) {
    if ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $name) {
      return $Object.$name
    }
  }

  return $Default
}

function Test-ExpectedMissingAfterCleanup {
  param(
    [Parameter(Mandatory = $true)]$Record,
    [Parameter(Mandatory = $true)][string]$Route
  )

  if (-not $Route) {
    return $false
  }

  $purpose = [string](Get-JsonValue -Object $Record -Names @("purpose") -Default "")
  return $Route -eq "known-temp-delete" -and $purpose -eq "known-temp-fixture"
}

foreach ($record in $manifest.records) {
  $expectedMissingAfterCleanup = Test-ExpectedMissingAfterCleanup -Record $record -Route $afterCleanupRouteClean
  $exists = Test-Path -LiteralPath $record.path
  $item = if ($exists) { Get-Item -LiteralPath $record.path } else { $null }
  $expectedBytes = [int64]$record.sizeMB * 1MB
  $actualBytes = if ($item) { [int64]$item.Length } else { 0 }
  $ageDays = if ($item) { [math]::Round(((Get-Date) - $item.LastWriteTime).TotalDays, 2) } else { 0 }
  $sizeMatches = if ($expectedMissingAfterCleanup) { $true } else { $actualBytes -eq $expectedBytes }
  $oldEnough = if ($expectedMissingAfterCleanup) { $true } else { $ageDays -ge ([double]$record.ageDays - 1) }
  $presenceMatches = if ($expectedMissingAfterCleanup) { -not $exists } else { $exists }

  $records += [PSCustomObject]@{
    path = $record.path
    purpose = $record.purpose
    expectedBytes = $expectedBytes
    actualBytes = $actualBytes
    expectedAgeDays = $record.ageDays
    actualAgeDays = $ageDays
    exists = $exists
    expectedMissingAfterCleanup = $expectedMissingAfterCleanup
    presenceMatches = $presenceMatches
    sizeMatches = $sizeMatches
    oldEnough = $oldEnough
  }
}

$missing = @($records | Where-Object { -not $_.exists -and -not $_.expectedMissingAfterCleanup })
$expectedMissingAfterCleanup = @($records | Where-Object { $_.expectedMissingAfterCleanup })
$unexpectedPresentAfterCleanup = @($records | Where-Object { $_.expectedMissingAfterCleanup -and $_.exists })
$sizeMismatches = @($records | Where-Object { $_.exists -and -not $_.expectedMissingAfterCleanup -and -not $_.sizeMatches })
$ageMismatches = @($records | Where-Object { $_.exists -and -not $_.expectedMissingAfterCleanup -and -not $_.oldEnough })

$evidence = [PSCustomObject]@{
  schemaVersion = "spaceguard-fixture-evidence/v1"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  manifestPath = $ManifestPath
  profileRoot = $manifest.profileRoot
  destructiveCommands = $false
  afterCleanupRoute = $afterCleanupRouteClean
  passed = ($missing.Count -eq 0 -and $unexpectedPresentAfterCleanup.Count -eq 0 -and $sizeMismatches.Count -eq 0 -and $ageMismatches.Count -eq 0)
  counts = [PSCustomObject]@{
    records = $records.Count
    missing = $missing.Count
    expectedMissingAfterCleanup = $expectedMissingAfterCleanup.Count
    unexpectedPresentAfterCleanup = $unexpectedPresentAfterCleanup.Count
    sizeMismatches = $sizeMismatches.Count
    ageMismatches = $ageMismatches.Count
  }
  records = $records
}

$evidenceDirectory = Split-Path -Parent $EvidencePath
New-Item -ItemType Directory -Path $evidenceDirectory -Force | Out-Null
$evidence | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $EvidencePath -Encoding UTF8

Write-Host "SpaceGuard fixture evidence written."
Write-Host "Evidence: $EvidencePath"
Write-Host "Passed: $($evidence.passed)"
Write-Host "No cleanup or delete command was run."
