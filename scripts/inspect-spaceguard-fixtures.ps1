param(
  [string]$ManifestPath = (Join-Path $env:TEMP "spaceguard-fixture-manifest.json"),
  [string]$EvidencePath = (Join-Path $env:TEMP "spaceguard-fixture-evidence.json"),
  [string]$DryRunScopeEvidencePath = "",
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

function Normalize-ComparableText {
  param([string]$Value)
  return ($Value -replace "/", "\").ToLowerInvariant().Trim()
}

function Get-DryRunEntries {
  param($Evidence)

  if ($null -eq $Evidence) {
    return @()
  }

  if ($Evidence -is [array]) {
    return @($Evidence)
  }

  $entries = Get-JsonValue -Object $Evidence -Names @("entries") -Default $null
  if ($entries) {
    return @($entries)
  }

  $result = Get-JsonValue -Object $Evidence -Names @("result", "nativeDryRun", "native_dry_run") -Default $null
  $resultEntries = Get-JsonValue -Object $result -Names @("entries") -Default $null
  if ($resultEntries) {
    return @($resultEntries)
  }

  return @()
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

$expectedDryRunCases = if ($manifest.PSObject.Properties.Name -contains "dryRunScopeCases") { @($manifest.dryRunScopeCases) } else { @() }
$dryRunEntries = @()
$dryRunScopeProvided = -not [string]::IsNullOrWhiteSpace($DryRunScopeEvidencePath)
$dryRunDestructiveCommands = $false

if ($dryRunScopeProvided) {
  if (-not (Test-Path -LiteralPath $DryRunScopeEvidencePath)) {
    throw "Dry-run scope evidence was not found: $DryRunScopeEvidencePath"
  }

  $dryRunEvidence = Get-Content -LiteralPath $DryRunScopeEvidencePath -Raw | ConvertFrom-Json
  $dryRunEntries = Get-DryRunEntries -Evidence $dryRunEvidence
  $dryRunDestructiveCommands = [bool](Get-JsonValue -Object $dryRunEvidence -Names @("destructiveCommands", "destructive_commands") -Default $false)
}

$dryRunScopeCases = @()
foreach ($case in $expectedDryRunCases) {
  $expectedId = [string](Get-JsonValue -Object $case -Names @("id") -Default "")
  $expectedRoute = [string](Get-JsonValue -Object $case -Names @("route") -Default "")
  $expectedTarget = [string](Get-JsonValue -Object $case -Names @("targetPath", "target_path") -Default "")
  $expectedStatus = [string](Get-JsonValue -Object $case -Names @("expectedTargetScopeStatus", "expected_target_scope_status") -Default "")
  $expectedRejectCode = [string](Get-JsonValue -Object $case -Names @("expectedRejectCode", "expected_reject_code") -Default "")
  $minCandidateCount = [int](Get-JsonValue -Object $case -Names @("minCandidateCount", "min_candidate_count") -Default 0)
  $maxCandidateCount = Get-JsonValue -Object $case -Names @("maxCandidateCount", "max_candidate_count") -Default $null

  $matched = @($dryRunEntries | Where-Object {
      $entryId = [string](Get-JsonValue -Object $_ -Names @("id") -Default "")
      $entryRoute = [string](Get-JsonValue -Object $_ -Names @("route") -Default "")
      $entryTarget = [string](Get-JsonValue -Object $_ -Names @("targetPath", "target_path") -Default "")
      ($expectedId -and $entryId -eq $expectedId) -or
        ($entryRoute -eq $expectedRoute -and (Normalize-ComparableText $entryTarget) -eq (Normalize-ComparableText $expectedTarget))
    } | Select-Object -First 1)

  $actualStatus = if ($matched.Count) { [string](Get-JsonValue -Object $matched[0] -Names @("targetScopeStatus", "target_scope_status") -Default "") } else { "" }
  $actualRejectCode = if ($matched.Count) { [string](Get-JsonValue -Object $matched[0] -Names @("rejectCode", "reject_code") -Default "") } else { "" }
  $actualCandidateCount = if ($matched.Count) { [int](Get-JsonValue -Object $matched[0] -Names @("candidateCount", "candidate_count") -Default 0) } else { 0 }
  $maxCandidateOk = if ($null -ne $maxCandidateCount) { $actualCandidateCount -le [int]$maxCandidateCount } else { $true }
  $casePassed = $dryRunScopeProvided -and
    $matched.Count -gt 0 -and
    $actualStatus -eq $expectedStatus -and
    $actualRejectCode -eq $expectedRejectCode -and
    $actualCandidateCount -ge $minCandidateCount -and
    $maxCandidateOk

  $dryRunScopeCases += [PSCustomObject]@{
    id = $expectedId
    title = [string](Get-JsonValue -Object $case -Names @("title") -Default $expectedId)
    route = $expectedRoute
    targetPath = $expectedTarget
    expectedTargetScopeStatus = $expectedStatus
    targetScopeStatus = $actualStatus
    expectedRejectCode = $expectedRejectCode
    rejectCode = $actualRejectCode
    candidateCount = $actualCandidateCount
    matched = $matched.Count -gt 0
    passed = $casePassed
  }
}

$dryRunFailures = @($dryRunScopeCases | Where-Object { -not $_.passed })
$dryRunAllowed = @($dryRunScopeCases | Where-Object { $_.targetScopeStatus -eq "target-allowed" })
$dryRunRejected = @($dryRunScopeCases | Where-Object { $_.targetScopeStatus -eq "target-blocked" })
$dryRunScopePassed = $dryRunScopeProvided -and
  -not $dryRunDestructiveCommands -and
  $dryRunScopeCases.Count -gt 0 -and
  $dryRunAllowed.Count -gt 0 -and
  $dryRunRejected.Count -gt 0 -and
  $dryRunFailures.Count -eq 0

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
  dryRunScopeCheck = [PSCustomObject]@{
    provided = $dryRunScopeProvided
    evidencePath = $DryRunScopeEvidencePath
    destructiveCommands = $dryRunDestructiveCommands
    passed = $dryRunScopePassed
    counts = [PSCustomObject]@{
      cases = $dryRunScopeCases.Count
      matched = @($dryRunScopeCases | Where-Object { $_.matched }).Count
      allowed = $dryRunAllowed.Count
      rejected = $dryRunRejected.Count
      failed = $dryRunFailures.Count
    }
    cases = $dryRunScopeCases
  }
}

$evidenceDirectory = Split-Path -Parent $EvidencePath
New-Item -ItemType Directory -Path $evidenceDirectory -Force | Out-Null
$evidence | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $EvidencePath -Encoding UTF8

Write-Host "SpaceGuard fixture evidence written."
Write-Host "Evidence: $EvidencePath"
Write-Host "Passed: $($evidence.passed)"
Write-Host "Dry-run scope evidence: $($evidence.dryRunScopeCheck.passed)"
Write-Host "No cleanup or delete command was run."
