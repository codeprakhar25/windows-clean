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
  $PreflightEvidenceRoot = Join-Path $EvidenceRoot "private-demo-preflight"
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

    return $proof
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
  $preflightCommand = "npm run demo:private-windows-preflight -- -EvidenceRoot `"$PreflightEvidenceRoot`" -SelectedRoute $SelectedRoute"
  $firstRouteCommand = "npm run proof:first-route:windows -- -Route temp-fixture -EvidenceRoot `"$FirstRouteEvidenceRoot`""
  $selectedRouteCommand = "npm run proof:route:windows -- -Route $SelectedRoute -EvidenceRoot `"$SelectedRouteEvidenceRoot`""

  if ($SkipLiveOpenAI) {
    $firstRouteCommand = "$firstRouteCommand -SkipLiveOpenAI"
    $selectedRouteCommand = "$selectedRouteCommand -SkipLiveOpenAI"
  }

  $commands = [PSCustomObject]@{
    privateWindowsPreflight = $preflightCommand
    firstRouteProof = $firstRouteCommand
    selectedRouteProof = $selectedRouteCommand
  }

  if ($SkipPreflight) {
    Write-CommandRecord -Record ([PSCustomObject]@{
        id = "private-windows-preflight"
        command = $preflightCommand
        outputPath = Join-Path $EvidenceRoot "private-demo-preflight.txt"
        exitCode = $null
        startedAt = (Get-Date).ToUniversalTime().ToString("o")
        endedAt = (Get-Date).ToUniversalTime().ToString("o")
        skipped = $true
        reason = "SkipPreflight"
      })
  } else {
    Invoke-LoggedCommand -Id "private-windows-preflight" -CommandLine $preflightCommand -OutputPath (Join-Path $EvidenceRoot "private-demo-preflight.txt") | Out-Null
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
      privateWindowsPreflight = Join-Path $PreflightEvidenceRoot "private-demo-preflight.json"
      firstRouteCompletionCheck = $FirstRouteCompletionPath
      selectedRouteCompletionCheck = $SelectedRouteCompletionPath
      archivedFirstRouteRootExports = $ArchiveRoot
    }
    routes = [PSCustomObject]@{
      firstRoute = "temp-fixture"
      firstRouteStatus = $firstRouteCompletion.status
      selectedRoute = $SelectedRoute
      selectedRouteStatus = $selectedRouteCompletion.status
    }
    firstRouteCompletion = [PSCustomObject]@{
      path = $FirstRouteCompletionPath
      status = $firstRouteCompletion.status
      canStartNextRoute = $firstRouteCompletion.canStartNextRoute
      reclaimedBytes = $firstRouteCompletion.counts.reclaimedBytes
    }
    selectedRouteCompletion = [PSCustomObject]@{
      path = $SelectedRouteCompletionPath
      status = $selectedRouteCompletion.status
      canStartNextRoute = $selectedRouteCompletion.canStartNextRoute
      route = $selectedRouteCompletion.route
      reclaimedBytes = $selectedRouteCompletion.counts.reclaimedBytes
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
