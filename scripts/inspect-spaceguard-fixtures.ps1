param(
  [string]$ManifestPath = (Join-Path $env:TEMP "spaceguard-fixture-manifest.json"),
  [string]$EvidencePath = (Join-Path $env:TEMP "spaceguard-fixture-evidence.json")
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ManifestPath)) {
  throw "Fixture manifest was not found: $ManifestPath"
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$records = @()

foreach ($record in $manifest.records) {
  $exists = Test-Path -LiteralPath $record.path
  $item = if ($exists) { Get-Item -LiteralPath $record.path } else { $null }
  $expectedBytes = [int64]$record.sizeMB * 1MB
  $actualBytes = if ($item) { [int64]$item.Length } else { 0 }
  $ageDays = if ($item) { [math]::Round(((Get-Date) - $item.LastWriteTime).TotalDays, 2) } else { 0 }

  $records += [PSCustomObject]@{
    path = $record.path
    purpose = $record.purpose
    expectedBytes = $expectedBytes
    actualBytes = $actualBytes
    expectedAgeDays = $record.ageDays
    actualAgeDays = $ageDays
    exists = $exists
    sizeMatches = $actualBytes -eq $expectedBytes
    oldEnough = $ageDays -ge ([double]$record.ageDays - 1)
  }
}

$missing = @($records | Where-Object { -not $_.exists })
$sizeMismatches = @($records | Where-Object { $_.exists -and -not $_.sizeMatches })
$ageMismatches = @($records | Where-Object { $_.exists -and -not $_.oldEnough })

$evidence = [PSCustomObject]@{
  schemaVersion = "spaceguard-fixture-evidence/v1"
  generatedAt = (Get-Date).ToUniversalTime().ToString("o")
  manifestPath = $ManifestPath
  profileRoot = $manifest.profileRoot
  destructiveCommands = $false
  passed = ($missing.Count -eq 0 -and $sizeMismatches.Count -eq 0 -and $ageMismatches.Count -eq 0)
  counts = [PSCustomObject]@{
    records = $records.Count
    missing = $missing.Count
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
