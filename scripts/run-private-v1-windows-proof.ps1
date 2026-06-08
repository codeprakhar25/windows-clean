param(
  [string]$SelectedRoute = "npm-cache",
  [string]$EvidenceRoot = "",
  [switch]$SkipLiveOpenAI,
  [switch]$SkipPreflight
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([System.Environment]::OSVersion.Platform -ne [System.PlatformID]::Win32NT) {
  throw "The private V1 Windows proof coordinator must be run on Windows because the native bundle and proof runners are Windows-targeted."
}

$SelectedRoute = $SelectedRoute.Trim()
if ([string]::IsNullOrWhiteSpace($SelectedRoute)) {
  throw "SelectedRoute is required. Example: npm run demo:private-v1-windows -- -SelectedRoute npm-cache"
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot

try {
  $RunStamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
  $RouteSlug = ($SelectedRoute.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim("-")
  if ([string]::IsNullOrWhiteSpace($RouteSlug)) {
    $RouteSlug = "selected-route"
  }

  if ([string]::IsNullOrWhiteSpace($EvidenceRoot)) {
    $EvidenceRoot = Join-Path $RepoRoot "evidence\private-v1-proof-$RouteSlug-$RunStamp"
  }

  $CommandLogPath = Join-Path $EvidenceRoot "commands.ndjson"
  $SummaryPath = Join-Path $EvidenceRoot "private-v1-proof.json"
  $PrivateV1ProofCheckPath = Join-Path $EvidenceRoot "private-v1-proof-check.json"
  $SelectedRouteSetupPath = Join-Path $EvidenceRoot "selected-route-setup.json"
  $PreflightEvidenceRoot = Join-Path $EvidenceRoot "private-demo-preflight"
  $PreflightSummaryPath = Join-Path $PreflightEvidenceRoot "private-demo-preflight.json"
  $PreflightLogPath = Join-Path $EvidenceRoot "private-demo-preflight.txt"
  $FirstRouteEvidenceRoot = Join-Path $EvidenceRoot "first-route-proof"
  $SelectedRouteEvidenceRoot = Join-Path $EvidenceRoot "selected-route-proof-$RouteSlug"
  $FirstRouteCompletionPath = Join-Path $FirstRouteEvidenceRoot "first-route-completion-check.json"
  $SelectedRouteCompletionPath = Join-Path $SelectedRouteEvidenceRoot "selected-route-completion-check.json"
  $ArchiveRoot = Join-Path $EvidenceRoot "archived-first-route-root-exports"
  $RootSelectedRouteProofPacketPath = Join-Path $RepoRoot "spaceguard-selected-route-proof-packet.md"
  $RootWorkflowProofPath = Join-Path $RepoRoot "spaceguard-real-workflow-proof.md"

  New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null

  function Write-JsonFile {
    param(
      [Parameter(Mandatory = $true)]$Value,
      [Parameter(Mandatory = $true)][string]$Path,
      [int]$Depth = 8
    )

    $Value | ConvertTo-Json -Depth $Depth | Set-Content -LiteralPath $Path -Encoding UTF8
  }

  function Write-CommandRecord {
    param(
      [Parameter(Mandatory = $true)]$Record
    )

    ($Record | ConvertTo-Json -Depth 8 -Compress) | Add-Content -LiteralPath $CommandLogPath -Encoding UTF8
  }

  function Invoke-LoggedCommand {
    param(
      [Parameter(Mandatory = $true)][string]$Id,
      [Parameter(Mandatory = $true)][string]$CommandLine,
      [Parameter(Mandatory = $true)][string]$OutputPath
    )

    $startedAt = (Get-Date).ToUniversalTime().ToString("o")
    Write-Host "[$Id] $CommandLine"

    & cmd.exe /d /c $CommandLine 2>&1 | Tee-Object -FilePath $OutputPath
    $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
    $endedAt = (Get-Date).ToUniversalTime().ToString("o")

    $record = [PSCustomObject]@{
      id = $Id
      command = $CommandLine
      outputPath = $OutputPath
      exitCode = $exitCode
      startedAt = $startedAt
      endedAt = $endedAt
    }
    Write-CommandRecord -Record $record

    if ($exitCode -ne 0) {
      throw "Command failed: $Id. See $OutputPath"
    }

    return $record
  }

  function Assert-KnownSelectedRoute {
    param(
      [Parameter(Mandatory = $true)][string]$Route,
      [Parameter(Mandatory = $true)][string]$Path
    )

    $startedAt = (Get-Date).ToUniversalTime().ToString("o")
    $commandLine = "node scripts\run-setup-route.mjs --route `"$Route`""
    Write-Host "[selected-route-setup] $commandLine"

    $output = @(& node "scripts\run-setup-route.mjs" "--route" $Route 2>&1)
    $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
    $text = ($output | ForEach-Object { $_.ToString() }) -join "`r`n"
    Set-Content -LiteralPath $Path -Value $text -Encoding UTF8
    $endedAt = (Get-Date).ToUniversalTime().ToString("o")

    Write-CommandRecord -Record ([PSCustomObject]@{
        id = "selected-route-setup"
        command = $commandLine
        outputPath = $Path
        exitCode = $exitCode
        startedAt = $startedAt
        endedAt = $endedAt
      })

    if ($exitCode -ne 0) {
      throw "selected-route-setup-failed: setup route command failed for $Route. See $Path"
    }

    try {
      $packet = $text | ConvertFrom-Json
    } catch {
      throw "selected-route-setup-invalid-json: setup route output could not be parsed. See $Path"
    }

    if ($packet.schemaVersion -ne "spaceguard-route-setup-packet/v1") {
      throw "selected-route-setup-schema: expected spaceguard-route-setup-packet/v1."
    }
    if ($packet.status -eq "unknown-route" -or $packet.status -eq "route-required" -or $null -eq $packet.selected) {
      throw "selected-route-unknown: SelectedRoute must match one setup:route alias before private V1 starts. See $Path"
    }
    if ($packet.route -eq "known-temp-delete") {
      throw "selected-route-bootstrap-disallowed: private V1 already runs temp-fixture as the seeded first route; choose a real-data selected route such as npm-cache."
    }

    return $packet
  }

  function Assert-ExistingPrivateWindowsPreflight {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
      throw "private-windows-preflight-skipped-missing: -SkipPreflight requires an existing passed preflight artifact at $Path"
    }

    $proof = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    if ($proof.schemaVersion -ne "spaceguard-private-demo-windows-preflight/v1") {
      throw "private-windows-preflight-skipped-schema: expected spaceguard-private-demo-windows-preflight/v1."
    }
    if ($proof.status -ne "passed") {
      throw "private-windows-preflight-skipped-status: reused preflight artifact must have status passed."
    }
    if ($proof.selectedRoute -ne $SelectedRoute) {
      throw "private-windows-preflight-skipped-route: reused preflight selectedRoute must match $SelectedRoute."
    }
    if ($null -eq $proof.nativeBundleArtifacts -or $proof.nativeBundleArtifacts.Count -lt 1) {
      throw "private-windows-preflight-skipped-bundle: reused preflight artifact must include copied native bundle artifacts."
    }

    return $proof
  }

  function Assert-AcceptedFirstRouteCompletion {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
      throw "first-route-completion-missing: expected first-route completion check at $Path"
    }

    $proof = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    if ($proof.schemaVersion -ne "spaceguard-first-route-completion-check/v1") {
      throw "first-route-completion-schema: expected spaceguard-first-route-completion-check/v1."
    }
    if ($proof.status -ne "accepted" -or $proof.canStartNextRoute -ne $true -or $proof.route -ne "known-temp-delete") {
      throw "first-route-completion-blocked: first route must be accepted before selected-route proof."
    }
    Assert-CompletionProofCounts -Proof $proof -Prefix "first-route" -Label "First-route"
    if ([int64]$proof.counts.reclaimedBytes -le 0) {
      throw "first-route-completion-empty: first route must prove positive reclaimed bytes."
    }

    return $proof
  }

  function Assert-AcceptedSelectedRouteCompletion {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
      throw "selected-route-completion-missing: expected selected-route completion check at $Path"
    }

    $proof = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    if ($proof.schemaVersion -ne "spaceguard-selected-route-completion-check/v1") {
      throw "selected-route-completion-schema: expected spaceguard-selected-route-completion-check/v1."
    }
    if ($proof.status -ne "accepted" -or $proof.canStartNextRoute -ne $true) {
      throw "selected-route-completion-blocked: selected route must be accepted for private V1 proof."
    }
    Assert-CompletionProofCounts -Proof $proof -Prefix "selected-route" -Label "Selected-route"

    return $proof
  }

  function Assert-CompletionProofCounts {
    param(
      [Parameter(Mandatory = $true)]$Proof,
      [Parameter(Mandatory = $true)][string]$Prefix,
      [Parameter(Mandatory = $true)][string]$Label
    )

    if ($null -eq $Proof.counts) {
      throw "$Prefix-completion-parity-missing: $Label completion must include counts."
    }

    $requiredCounts = @(
      "reclaimedBytes",
      "selectedRouteProofPacketReclaimedBytes",
      "ledgerReclaimedBytes",
      "rescanExpectedBytes",
      "rescanActualRemainingBytes"
    )

    $values = @{}
    foreach ($name in $requiredCounts) {
      $property = $Proof.counts.PSObject.Properties[$name]
      if ($null -eq $property -or $null -eq $property.Value) {
        throw "$Prefix-completion-parity-missing: $Label completion must include counts.$name."
      }
      $values[$name] = [int64]$property.Value
    }

    if ($values.reclaimedBytes -le 0) {
      throw "$Prefix-completion-parity-empty: $Label completion must prove positive reclaimed bytes."
    }

    foreach ($name in @("selectedRouteProofPacketReclaimedBytes", "ledgerReclaimedBytes", "rescanExpectedBytes")) {
      if ($values[$name] -ne $values.reclaimedBytes) {
        throw "$Prefix-completion-parity: $Label completion counts.$name must match counts.reclaimedBytes."
      }
    }

    if ($values.rescanActualRemainingBytes -lt 0) {
      throw "$Prefix-completion-parity: $Label completion counts.rescanActualRemainingBytes must be non-negative."
    }
  }

  function Archive-FirstRouteRootExports {
    $archived = @()
    foreach ($proofPath in @($RootSelectedRouteProofPacketPath, $RootWorkflowProofPath)) {
      if (Test-Path -LiteralPath $proofPath) {
        New-Item -ItemType Directory -Path $ArchiveRoot -Force | Out-Null
        $destination = Join-Path $ArchiveRoot (Split-Path -Leaf $proofPath)
        Move-Item -LiteralPath $proofPath -Destination $destination -Force
        $archived += [PSCustomObject]@{
          source = $proofPath
          destination = $destination
        }
      }
    }

    Write-CommandRecord -Record ([PSCustomObject]@{
        id = "archive-first-route-root-exports"
        command = "archive first-route repo-root proof exports"
        outputPath = $ArchiveRoot
        exitCode = 0
        startedAt = (Get-Date).ToUniversalTime().ToString("o")
        endedAt = (Get-Date).ToUniversalTime().ToString("o")
        archived = $archived
      })

    return $archived
  }

  $startedAt = (Get-Date).ToUniversalTime().ToString("o")
  $selectedRouteSetup = Assert-KnownSelectedRoute -Route $SelectedRoute -Path $SelectedRouteSetupPath
  $preflightCommand = "npm run demo:private-windows-preflight -- -EvidenceRoot `"$PreflightEvidenceRoot`" -SelectedRoute $SelectedRoute"
  $firstRouteCommand = "npm run proof:first-route:windows -- -Route temp-fixture -EvidenceRoot `"$FirstRouteEvidenceRoot`""
  $selectedRouteCommand = "npm run proof:route:windows -- -Route $SelectedRoute -EvidenceRoot `"$SelectedRouteEvidenceRoot`""

  if ($SkipLiveOpenAI) {
    $firstRouteCommand = "$firstRouteCommand -SkipLiveOpenAI"
    $selectedRouteCommand = "$selectedRouteCommand -SkipLiveOpenAI"
  }

  $commands = [PSCustomObject]@{
    selectedRouteSetup = "node scripts\run-setup-route.mjs --route `"$SelectedRoute`""
    privateWindowsPreflight = $preflightCommand
    firstRouteProof = $firstRouteCommand
    selectedRouteProof = $selectedRouteCommand
  }

  if ($SkipPreflight) {
    $preflightProof = Assert-ExistingPrivateWindowsPreflight -Path $PreflightSummaryPath
    Write-CommandRecord -Record ([PSCustomObject]@{
        id = "private-windows-preflight"
        command = $preflightCommand
        outputPath = $PreflightSummaryPath
        exitCode = 0
        startedAt = (Get-Date).ToUniversalTime().ToString("o")
        endedAt = (Get-Date).ToUniversalTime().ToString("o")
        skipped = $true
        reused = $true
        reason = "SkipPreflightExistingEvidence"
        selectedRoute = $preflightProof.selectedRoute
        nativeBundleArtifactCount = [int]$preflightProof.nativeBundleArtifacts.Count
      })
  } else {
    Invoke-LoggedCommand -Id "private-windows-preflight" -CommandLine $preflightCommand -OutputPath $PreflightLogPath | Out-Null
  }

  Invoke-LoggedCommand -Id "first-route-proof" -CommandLine $firstRouteCommand -OutputPath (Join-Path $EvidenceRoot "first-route-proof.txt") | Out-Null
  $firstRouteCompletion = Assert-AcceptedFirstRouteCompletion -Path $FirstRouteCompletionPath

  [System.Environment]::SetEnvironmentVariable("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK", $FirstRouteCompletionPath, "Process")
  Write-CommandRecord -Record ([PSCustomObject]@{
      id = "bind-first-route-completion"
      command = "set SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK"
      outputPath = $FirstRouteCompletionPath
      exitCode = 0
      startedAt = (Get-Date).ToUniversalTime().ToString("o")
      endedAt = (Get-Date).ToUniversalTime().ToString("o")
      key = "SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK"
      value = $FirstRouteCompletionPath
    })

  $archivedRootExports = Archive-FirstRouteRootExports
  Invoke-LoggedCommand -Id "selected-route-proof" -CommandLine $selectedRouteCommand -OutputPath (Join-Path $EvidenceRoot "selected-route-proof.txt") | Out-Null
  $selectedRouteCompletion = Assert-AcceptedSelectedRouteCompletion -Path $SelectedRouteCompletionPath

  $summary = [PSCustomObject]@{
    schemaVersion = "spaceguard-private-v1-windows-proof/v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    startedAt = $startedAt
    status = "accepted"
    selectedRoute = $SelectedRoute
    evidenceRoot = $EvidenceRoot
    commandLogPath = $CommandLogPath
    destructiveCommands = $false
    directCleanupCommands = $false
    artifacts = [PSCustomObject]@{
      privateV1Proof = $SummaryPath
      privateV1ProofCheck = $PrivateV1ProofCheckPath
      selectedRouteSetup = $SelectedRouteSetupPath
      privateWindowsPreflight = $PreflightSummaryPath
      firstRouteCompletionCheck = $FirstRouteCompletionPath
      selectedRouteCompletionCheck = $SelectedRouteCompletionPath
      archivedFirstRouteRootExports = $ArchiveRoot
    }
    routes = [PSCustomObject]@{
      firstRoute = "temp-fixture"
      firstRouteStatus = $firstRouteCompletion.status
      selectedRoute = $SelectedRoute
      selectedRouteSetupStatus = $selectedRouteSetup.status
      selectedRouteCanonical = $selectedRouteSetup.route
      selectedRouteStatus = $selectedRouteCompletion.status
    }
    firstRouteCompletion = [PSCustomObject]@{
      path = $FirstRouteCompletionPath
      status = $firstRouteCompletion.status
      canStartNextRoute = $firstRouteCompletion.canStartNextRoute
      reclaimedBytes = $firstRouteCompletion.counts.reclaimedBytes
      ledgerReclaimedBytes = $firstRouteCompletion.counts.ledgerReclaimedBytes
      rescanExpectedBytes = $firstRouteCompletion.counts.rescanExpectedBytes
      rescanActualRemainingBytes = $firstRouteCompletion.counts.rescanActualRemainingBytes
    }
    selectedRouteCompletion = [PSCustomObject]@{
      path = $SelectedRouteCompletionPath
      status = $selectedRouteCompletion.status
      canStartNextRoute = $selectedRouteCompletion.canStartNextRoute
      route = $selectedRouteCompletion.route
      reclaimedBytes = $selectedRouteCompletion.counts.reclaimedBytes
      ledgerReclaimedBytes = $selectedRouteCompletion.counts.ledgerReclaimedBytes
      rescanExpectedBytes = $selectedRouteCompletion.counts.rescanExpectedBytes
      rescanActualRemainingBytes = $selectedRouteCompletion.counts.rescanActualRemainingBytes
    }
    archivedRootExports = $archivedRootExports
    commands = $commands
    primary = "Private V1 Windows proof accepted: preflight, seeded first-route cleanup proof, first-route completion binding, and selected real-data route proof all passed."
  }

  Write-JsonFile -Value $summary -Path $SummaryPath
  Invoke-LoggedCommand -Id "private-v1-proof-check" -CommandLine "node scripts\run-private-v1-proof-check.mjs --file `"$SummaryPath`"" -OutputPath $PrivateV1ProofCheckPath | Out-Null

  Write-Host ""
  Write-Host "SpaceGuard private V1 Windows proof accepted."
  Write-Host "Evidence root: $EvidenceRoot"
  Write-Host "V1 proof artifact: $SummaryPath"
  Write-Host "V1 proof check: $PrivateV1ProofCheckPath"
  Write-Host "Selected route: $SelectedRoute"
} finally {
  Pop-Location
}
