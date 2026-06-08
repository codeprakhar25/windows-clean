param(
  [string]$Route = "npm-cache",
  [string]$EvidenceRoot = "",
  [switch]$SkipLiveOpenAI,
  [switch]$SkipLaunch,
  [switch]$SkipPostAppValidation,
  [switch]$FinalizeOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([System.Environment]::OSVersion.Platform -ne [System.PlatformID]::Win32NT) {
  throw "The selected-route proof runner must be run on Windows because native scoped executors are Windows-only."
}

$Route = $Route.Trim()
if ([string]::IsNullOrWhiteSpace($Route)) {
  throw "Route is required. Example: npm run proof:route:windows -- -Route npm-cache"
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot

try {
  $RunStamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
  $RouteSlug = ($Route.ToLowerInvariant() -replace '[^a-z0-9]+', '-').Trim("-")
  if ([string]::IsNullOrWhiteSpace($RouteSlug)) {
    $RouteSlug = "selected-route"
  }

  $EvidenceRootProvided = -not [string]::IsNullOrWhiteSpace($EvidenceRoot)
  if ($FinalizeOnly -and -not $EvidenceRootProvided) {
    throw "FinalizeOnly requires -EvidenceRoot pointing at an existing selected-route evidence folder."
  }
  if ($FinalizeOnly -and -not (Test-Path -LiteralPath $EvidenceRoot)) {
    throw "FinalizeOnly evidence root does not exist: $EvidenceRoot"
  }
  if ([string]::IsNullOrWhiteSpace($EvidenceRoot)) {
    $EvidenceRoot = Join-Path $RepoRoot "evidence\route-proof-$RouteSlug-$RunStamp"
  }

  $SetupDoctorPath = Join-Path $EvidenceRoot "setup-doctor.json"
  $FixtureSmokePath = Join-Path $EvidenceRoot "openai-fixture-smoke.txt"
  $LiveSmokePath = Join-Path $EvidenceRoot "openai-live-smoke.txt"
  $SetupRoutePath = Join-Path $EvidenceRoot "setup-route.json"
  $ValidateRoutePath = Join-Path $EvidenceRoot "validate-route.json"
  $CommandLogPath = Join-Path $EvidenceRoot "commands.ndjson"
  $PreflightPath = Join-Path $EvidenceRoot "operator-preflight.json"
  $PreflightCheckPath = Join-Path $EvidenceRoot "operator-preflight-check.json"
  $OperatorAppHandoffPath = Join-Path $EvidenceRoot "operator-app-handoff.md"
  $SelectedRouteProofPacketPath = Join-Path $RepoRoot "spaceguard-selected-route-proof-packet.md"
  $WorkflowProofPath = Join-Path $RepoRoot "spaceguard-real-workflow-proof.md"
  $WorkflowProofCheckPath = Join-Path $EvidenceRoot "workflow-proof-check.json"
  $CompletionCheckPath = Join-Path $EvidenceRoot "selected-route-completion-check.json"
  $PostAppFinalizationPath = Join-Path $EvidenceRoot "post-app-finalization.json"
  $NativeDevExitPath = Join-Path $EvidenceRoot "native-dev-exit.json"

  New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null

  function Import-SpaceGuardDotEnv {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
      return
    }

    foreach ($line in Get-Content -LiteralPath $Path) {
      $clean = $line.Trim()
      if (-not $clean -or $clean.StartsWith("#")) {
        continue
      }

      if ($clean.StartsWith("export ")) {
        $clean = $clean.Substring("export ".Length).Trim()
      }

      $separator = $clean.IndexOf("=")
      if ($separator -lt 1) {
        continue
      }

      $name = $clean.Substring(0, $separator).Trim()
      $value = $clean.Substring($separator + 1).Trim()
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
      }

      if ($name -and -not [System.Environment]::GetEnvironmentVariable($name, "Process")) {
        [System.Environment]::SetEnvironmentVariable($name, $value, "Process")
      }
    }
  }

  function Get-SelectedRouteSpec {
    param([Parameter(Mandatory = $true)][string]$InputRoute)

    $key = $InputRoute.Trim().ToLowerInvariant()
    switch ($key) {
      "project-deps" { return [PSCustomObject]@{ alias = "project-deps"; route = "item-review-project-cache"; envVar = "SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR"; requestMode = "execute-project-deps"; panelId = "project-dependency-executor-panel" } }
      "project-dependencies" { return [PSCustomObject]@{ alias = "project-deps"; route = "item-review-project-cache"; envVar = "SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR"; requestMode = "execute-project-deps"; panelId = "project-dependency-executor-panel" } }
      "downloads" { return [PSCustomObject]@{ alias = "downloads"; route = "item-review-recycle-bin"; envVar = "SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR"; requestMode = "execute-downloads-recycle-bin"; panelId = "downloads-cleanup-executor-panel" } }
      "large-files" { return [PSCustomObject]@{ alias = "large-files"; route = "item-review-large-files"; envVar = "SPACEGUARD_ENABLE_LARGE_FILE_ARCHIVE_EXECUTOR"; requestMode = "execute-large-file-archive"; panelId = "large-file-archive-executor-panel" } }
      "browser-cache" { return [PSCustomObject]@{ alias = "browser-cache"; route = "browser-cache-only"; envVar = "SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR"; requestMode = "execute-browser-cache"; panelId = "browser-cache-executor-panel" } }
      "gradle-cache" { return [PSCustomObject]@{ alias = "gradle-cache"; route = "bounded-cache-delete"; envVar = "SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR"; requestMode = "execute-gradle-cache"; panelId = "gradle-cache-executor-panel" } }
      "user-cache" { return [PSCustomObject]@{ alias = "user-cache"; route = "bounded-user-cache-delete"; envVar = "SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR"; requestMode = "execute-user-cache"; panelId = "user-cache-executor-panel" } }
      "android-cache" { return [PSCustomObject]@{ alias = "android-cache"; route = "bounded-android-cache-delete"; envVar = "SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR"; requestMode = "execute-android-cache"; panelId = "android-cache-executor-panel" } }
      "shader-cache" { return [PSCustomObject]@{ alias = "shader-cache"; route = "launcher-cache-cleanup"; envVar = "SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR"; requestMode = "execute-shader-cache"; panelId = "shader-cache-executor-panel" } }
      "pip-cache" { return [PSCustomObject]@{ alias = "pip-cache"; route = "bounded-pip-cache-delete"; envVar = "SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR"; requestMode = "execute-pip-cache"; panelId = "pip-cache-executor-panel" } }
      "docker-build-cache" { return [PSCustomObject]@{ alias = "docker-build-cache"; route = "tool-native-docker-build-cache-prune"; envVar = "SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS"; requestMode = "execute-docker-build-cache"; panelId = "docker-build-cache-executor-panel" } }
      "npm-cache" { return [PSCustomObject]@{ alias = "npm-cache"; route = "bounded-npm-cache-delete"; envVar = "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR"; requestMode = "execute-npm-cache"; panelId = "npm-cache-executor-panel" } }
      "pnpm-store" { return [PSCustomObject]@{ alias = "pnpm-store"; route = "bounded-pnpm-store-delete"; envVar = "SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR"; requestMode = "execute-pnpm-store"; panelId = "pnpm-store-executor-panel" } }
      "recycle-bin" { return [PSCustomObject]@{ alias = "recycle-bin"; route = "shell-recycle-bin"; envVar = "SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR"; requestMode = "execute-recycle-bin"; panelId = "recycle-bin-executor-panel" } }
      default {
        throw "Unsupported selected-route proof route '$InputRoute'. Use setup:route aliases such as npm-cache, pnpm-store, gradle-cache, user-cache, browser-cache, project-deps, downloads, large-files, or recycle-bin."
      }
    }
  }

  function Get-ScopedExecutorFlags {
    return @(
      "SPACEGUARD_ENABLE_TEMP_EXECUTOR",
      "SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR",
      "SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR",
      "SPACEGUARD_ENABLE_LARGE_FILE_ARCHIVE_EXECUTOR",
      "SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR",
      "SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR",
      "SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR",
      "SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR",
      "SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR",
      "SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS",
      "SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR",
      "SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR",
      "SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR",
      "SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR"
    )
  }

  function Set-SelectedRouteExecutorEnvironment {
    param([Parameter(Mandatory = $true)]$Spec)

    foreach ($flag in Get-ScopedExecutorFlags) {
      [System.Environment]::SetEnvironmentVariable($flag, "0", "Process")
    }

    [System.Environment]::SetEnvironmentVariable($Spec.envVar, "1", "Process")
    [System.Environment]::SetEnvironmentVariable("SPACEGUARD_ROUTE_SETUP_IGNORE_DOTENV", "1", "Process")
  }

  function Assert-OneSelectedRouteFlag {
    param([Parameter(Mandatory = $true)]$Spec)

    $enabled = @()
    foreach ($flag in Get-ScopedExecutorFlags) {
      $value = [System.Environment]::GetEnvironmentVariable($flag, "Process")
      if ($value -eq "1" -or $value -eq "true" -or $value -eq "yes") {
        $enabled += $flag
      }
    }

    if ($enabled.Count -ne 1 -or $enabled[0] -ne $Spec.envVar) {
      throw "Selected-route proof requires exactly one scoped executor flag, $($Spec.envVar). Enabled flags: $($enabled -join ', ')"
    }
  }

  function Assert-CleanProofExportSlots {
    $staleExports = @()
    foreach ($proofPath in @($SelectedRouteProofPacketPath, $WorkflowProofPath)) {
      if (Test-Path -LiteralPath $proofPath) {
        $staleExports += $proofPath
      }
    }

    if ($staleExports.Count -gt 0) {
      throw "stale-proof-export: Move or archive existing root proof export(s) before starting a new selected-route app launch. Use -FinalizeOnly with an existing evidence root after app export. Existing file(s): $($staleExports -join ', ')"
    }
  }

  function Assert-AcceptedFirstRouteCompletion {
    $proofPath = [System.Environment]::GetEnvironmentVariable("SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK", "Process")
    if ([string]::IsNullOrWhiteSpace($proofPath)) {
      throw "SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK must point to an accepted first-route completion check JSON before selected-route proof."
    }
    if (-not (Test-Path -LiteralPath $proofPath)) {
      throw "SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK points to a missing file: $proofPath"
    }

    $proof = Get-Content -LiteralPath $proofPath -Raw | ConvertFrom-Json
    if ($proof.schemaVersion -ne "spaceguard-first-route-completion-check/v1") {
      throw "SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK must use spaceguard-first-route-completion-check/v1."
    }
    if ($proof.status -ne "accepted" -or $proof.canStartNextRoute -ne $true -or $proof.route -ne "known-temp-delete") {
      throw "SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK is not accepted for known-temp-delete."
    }
    if ([int64]$proof.counts.reclaimedBytes -le 0) {
      throw "SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK must show positive reclaimed bytes."
    }

    return $proofPath
  }

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
      [Parameter(Mandatory = $true)][string]$OutputPath,
      [switch]$AllowFailure
    )

    $startedAt = (Get-Date).ToUniversalTime().ToString("o")
    Write-Host "[$Id] $CommandLine"

    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = "cmd.exe"
    $startInfo.Arguments = "/d /c $CommandLine"
    $startInfo.WorkingDirectory = $RepoRoot
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $process = [System.Diagnostics.Process]::Start($startInfo)
    $stdout = $process.StandardOutput.ReadToEnd()
    $stderr = $process.StandardError.ReadToEnd()
    $process.WaitForExit()

    $endedAt = (Get-Date).ToUniversalTime().ToString("o")
    $stderrPath = "$OutputPath.stderr.txt"
    Set-Content -LiteralPath $OutputPath -Value $stdout -Encoding UTF8
    Set-Content -LiteralPath $stderrPath -Value $stderr -Encoding UTF8

    $record = [PSCustomObject]@{
      id = $Id
      command = $CommandLine
      outputPath = $OutputPath
      stderrPath = $stderrPath
      exitCode = $process.ExitCode
      startedAt = $startedAt
      endedAt = $endedAt
      allowedToFail = [bool]$AllowFailure
    }
    Write-CommandRecord -Record $record

    if ($process.ExitCode -ne 0 -and -not $AllowFailure) {
      throw "Command failed: $Id. See $OutputPath"
    }

    return $record
  }

  function Complete-PostAppValidation {
    param(
      [Parameter(Mandatory = $true)][string]$Reason
    )

    $startedAt = (Get-Date).ToUniversalTime().ToString("o")
    $summary = [PSCustomObject]@{
      schemaVersion = "spaceguard-selected-route-post-app-finalization/v1"
      generatedAt = $startedAt
      reason = $Reason
      evidenceRoot = $EvidenceRoot
      route = $Route
      nativeRoute = $RouteSpec.route
      workflowProofPath = $WorkflowProofPath
      workflowProofExists = Test-Path -LiteralPath $WorkflowProofPath
      status = "selected-route-workflow-proof-required"
      skipped = $false
      commands = [PSCustomObject]@{
        validateWorkflowProof = "node scripts\run-workflow-proof-check.mjs --file `"$WorkflowProofPath`""
        validateSelectedRouteCompletion = "node scripts\run-route-completion-check.mjs --preflight `"$PreflightPath`" --native-exit `"$NativeDevExitPath`" --workflow-proof `"$WorkflowProofPath`""
      }
      artifacts = [PSCustomObject]@{
        workflowProofCheck = $WorkflowProofCheckPath
        selectedRouteCompletionCheck = $CompletionCheckPath
        finalization = $PostAppFinalizationPath
        nativeDevExit = $NativeDevExitPath
      }
    }

    if ($SkipPostAppValidation -or $Reason -eq "launch-skipped" -or $Reason -eq "native-dev-failed") {
      $summary.skipped = $true
      if ($Reason -eq "launch-skipped") {
        $summary.reason = "launch-skipped"
      } elseif ($Reason -eq "native-dev-failed") {
        $summary.reason = "native-dev-failed"
      } else {
        $summary.reason = "SkipPostAppValidation"
      }
      Write-JsonFile -Value $summary -Path $PostAppFinalizationPath
      Write-CommandRecord -Record ([PSCustomObject]@{
          id = "finalize-after-app"
          command = "post-app validation skipped"
          outputPath = $PostAppFinalizationPath
          exitCode = $null
          startedAt = $startedAt
          endedAt = (Get-Date).ToUniversalTime().ToString("o")
          skipped = $true
          reason = $summary.reason
        })
      return
    }

    Write-JsonFile -Value $summary -Path $PostAppFinalizationPath
    Write-CommandRecord -Record ([PSCustomObject]@{
        id = "finalize-after-app"
        command = "validate selected-route workflow proof"
        outputPath = $PostAppFinalizationPath
        exitCode = $null
        startedAt = $startedAt
        userGated = $true
      })

    Invoke-LoggedCommand -Id "workflow-proof-check" -CommandLine $summary.commands.validateWorkflowProof -OutputPath $WorkflowProofCheckPath | Out-Null
    Invoke-LoggedCommand -Id "validate-selected-route-completion" -CommandLine $summary.commands.validateSelectedRouteCompletion -OutputPath $CompletionCheckPath | Out-Null
    $summary.status = "selected-route-completion-accepted"
    $summary.workflowProofCheckPath = $WorkflowProofCheckPath
    $summary.selectedRouteCompletionCheckPath = $CompletionCheckPath
    Write-JsonFile -Value $summary -Path $PostAppFinalizationPath
  }

  function Write-OperatorAppHandoff {
    $ValidateWorkflowProofCommand = "npm run validate:workflow-proof -- --file .\spaceguard-real-workflow-proof.md"
    $ValidateCompletionCommand = "npm run validate:route-completion -- --preflight `"$PreflightPath`" --native-exit `"$NativeDevExitPath`" --workflow-proof .\spaceguard-real-workflow-proof.md"
    $EnableRouteFlagCommand = '$env:' + $RouteSpec.envVar + '="1"'
    $IgnoreDotEnvCommand = '$env:SPACEGUARD_ROUTE_SETUP_IGNORE_DOTENV="1"'
    $RouteProofCommand = "npm run proof:route:windows -- -Route $Route"
    $lines = @(
      "# SpaceGuard Selected-Route App Handoff",
      "",
      "Evidence root: $EvidenceRoot",
      "Preflight bundle: $PreflightPath",
      "Route: $Route",
      "Native route: $($RouteSpec.route)",
      "Required flag: $($RouteSpec.envVar)",
      "",
      "## Selected route fast path",
      $IgnoreDotEnvCommand,
      $EnableRouteFlagCommand,
      $RouteProofCommand,
      "The runner forces every other scoped executor flag off in the process before launching the app.",
      "",
      "## In-app steps",
      "1. Run real scan in the Tauri desktop app.",
      "2. Select only the scanned target(s) for $Route.",
      "3. Arm consent for the current plan and scan fingerprint.",
      "4. Use OpenAI cleanup agent only for ranking and brokered follow-through; it cannot approve or run cleanup.",
      "5. Run the selected scoped executor from $($RouteSpec.panelId).",
      "6. Confirm native volume proof is present on the write response.",
      "7. Run post-run rescan.",
      "8. Export spaceguard-selected-route-proof-packet.md to the repo root.",
      "9. Complete Selected route proof import with reviewer and artifact path.",
      "10. Re-export spaceguard-selected-route-proof-packet.md to the repo root after import complete.",
      "11. Export spaceguard-real-workflow-proof.md to the repo root before closing the app.",
      "12. Do not close the app until native volume proof, selected-route proof import, and workflow proof export are complete.",
      "",
      "## Resume validation",
      "npm run proof:route:windows:finalize -- -Route $Route -EvidenceRoot `"$EvidenceRoot`"",
      "",
      "## Expected final check",
      $ValidateWorkflowProofCommand,
      $ValidateCompletionCommand
    )
    Set-Content -LiteralPath $OperatorAppHandoffPath -Value $lines -Encoding UTF8
  }

  Import-SpaceGuardDotEnv -Path (Join-Path $RepoRoot ".env")
  $RouteSpec = Get-SelectedRouteSpec -InputRoute $Route
  $FirstRouteCompletionPath = Assert-AcceptedFirstRouteCompletion
  Set-SelectedRouteExecutorEnvironment -Spec $RouteSpec
  Assert-OneSelectedRouteFlag -Spec $RouteSpec

  if ($FinalizeOnly) {
    Complete-PostAppValidation -Reason "finalize-only"
    Write-Host ""
    Write-Host "Finalized existing selected-route evidence root: $EvidenceRoot"
    Write-Host "Workflow proof check: $WorkflowProofCheckPath"
    Write-Host "Selected-route completion check: $CompletionCheckPath"
    return
  }
  if (-not $SkipLaunch) {
    Assert-CleanProofExportSlots
  }

  $liveOpenAiConfigured = -not [string]::IsNullOrWhiteSpace([System.Environment]::GetEnvironmentVariable("OPENAI_API_KEY", "Process"))

  Invoke-LoggedCommand -Id "setup-doctor" -CommandLine "npm run setup:doctor" -OutputPath $SetupDoctorPath | Out-Null
  Invoke-LoggedCommand -Id "openai-fixture-smoke" -CommandLine "npm run openai:smoke:fixture -- --route $Route" -OutputPath $FixtureSmokePath | Out-Null

  if ($SkipLiveOpenAI) {
    Write-CommandRecord -Record ([PSCustomObject]@{
        id = "openai-live-smoke"
        command = "npm run openai:smoke -- --route $Route"
        outputPath = $LiveSmokePath
        exitCode = $null
        startedAt = (Get-Date).ToUniversalTime().ToString("o")
        endedAt = (Get-Date).ToUniversalTime().ToString("o")
        skipped = $true
        reason = "SkipLiveOpenAI"
      })
  } elseif ($liveOpenAiConfigured) {
    Invoke-LoggedCommand -Id "openai-live-smoke" -CommandLine "npm run openai:smoke -- --route $Route" -OutputPath $LiveSmokePath | Out-Null
  } else {
    Write-CommandRecord -Record ([PSCustomObject]@{
        id = "openai-live-smoke"
        command = "npm run openai:smoke -- --route $Route"
        outputPath = $LiveSmokePath
        exitCode = $null
        startedAt = (Get-Date).ToUniversalTime().ToString("o")
        endedAt = (Get-Date).ToUniversalTime().ToString("o")
        skipped = $true
        reason = "OPENAI_API_KEY missing"
      })
  }

  Invoke-LoggedCommand -Id "setup-route" -CommandLine "npm run setup:route -- --route $Route" -OutputPath $SetupRoutePath | Out-Null
  Invoke-LoggedCommand -Id "validate-route" -CommandLine "npm run validate:route -- --route $Route" -OutputPath $ValidateRoutePath | Out-Null

  $preflight = [PSCustomObject]@{
    schemaVersion = "spaceguard-selected-route-windows-operator/v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    routeInput = $Route
    route = $RouteSpec.route
    routeAlias = $RouteSpec.alias
    requestMode = $RouteSpec.requestMode
    panelId = $RouteSpec.panelId
    evidenceRoot = $EvidenceRoot
    firstRouteCompletionCheck = $FirstRouteCompletionPath
    destructiveCommands = $false
    directCleanupCommands = $false
    scopedExecutor = [PSCustomObject]@{
      enabledFlag = $RouteSpec.envVar
      enabledValue = [System.Environment]::GetEnvironmentVariable($RouteSpec.envVar, "Process")
      dotenvExecutorFlagsIgnored = [System.Environment]::GetEnvironmentVariable("SPACEGUARD_ROUTE_SETUP_IGNORE_DOTENV", "Process")
      siblingFlagsForcedOff = $true
    }
    openAi = [PSCustomObject]@{
      liveSmokeConfigured = $liveOpenAiConfigured
      liveSmokeSkipped = [bool]($SkipLiveOpenAI -or -not $liveOpenAiConfigured)
    }
    artifacts = [PSCustomObject]@{
      commandLog = $CommandLogPath
      setupDoctor = $SetupDoctorPath
      setupRoute = $SetupRoutePath
      validateRoute = $ValidateRoutePath
      routePreflightCheck = $PreflightCheckPath
      openAiFixtureSmoke = $FixtureSmokePath
      openAiLiveSmoke = $LiveSmokePath
      nativeDevExit = $NativeDevExitPath
      operatorAppHandoff = $OperatorAppHandoffPath
      selectedRouteProofPacket = $SelectedRouteProofPacketPath
      workflowProof = $WorkflowProofPath
      workflowProofCheck = $WorkflowProofCheckPath
      selectedRouteCompletionCheck = $CompletionCheckPath
    }
    appCloseContract = [PSCustomObject]@{
      schemaVersion = "spaceguard-selected-route-app-close-contract/v1"
      workflowProofPath = $WorkflowProofPath
      selectedRouteProofPacketPath = $SelectedRouteProofPacketPath
      expectedWorkflowProofSchema = "spaceguard-real-workflow-proof/v1"
      minimumReclaimedBytes = 1
      nextRouteBlockedUntil = "validate:workflow-proof accepted"
      requiredBeforeClosingApp = @(
        "native-volume-proof-captured",
        "post-run-rescan-matched",
        "selected-route-proof-packet-exported",
        "selected-route-proof-import-complete",
        "spaceguard-real-workflow-proof-exported"
      )
    }
    userGatedAppSteps = @(
      "Run real scan in the Tauri desktop app.",
      "Select only the scanned target(s) for $Route.",
      "Arm consent for the current plan and scan fingerprint.",
      "Run the selected scoped executor from $($RouteSpec.panelId).",
      "Confirm native volume proof is present.",
      "Run post-run rescan.",
      "Export, import, then re-export the selected route proof packet.",
      "Export spaceguard-real-workflow-proof.md."
    )
    afterAppCommands = [PSCustomObject]@{
      validateWorkflowProof = "npm run validate:workflow-proof -- --file .\spaceguard-real-workflow-proof.md"
      validateSelectedRouteCompletion = "npm run validate:route-completion -- --preflight `"$PreflightPath`" --native-exit `"$NativeDevExitPath`" --workflow-proof .\spaceguard-real-workflow-proof.md"
    }
  }

  Write-OperatorAppHandoff
  Write-JsonFile -Value $preflight -Path $PreflightPath
  Invoke-LoggedCommand -Id "validate-selected-route-preflight" -CommandLine "node scripts\run-route-preflight-check.mjs --file `"$PreflightPath`"" -OutputPath $PreflightCheckPath | Out-Null

  Write-Host ""
  Write-Host "SpaceGuard selected-route preflight complete."
  Write-Host "Evidence root: $EvidenceRoot"
  Write-Host "Preflight bundle: $PreflightPath"
  Write-Host "Route: $Route -> $($RouteSpec.route)"
  Write-Host "Scoped flag: $($RouteSpec.envVar)"
  Write-Host ""
  Write-Host "The runner has not performed cleanup. Continue in the desktop app:"
  foreach ($step in $preflight.userGatedAppSteps) {
    Write-Host " - $step"
  }
  Write-Host ""
  Write-Host "Before closing the app, satisfy selected-route app-close proof contract:"
  foreach ($step in $preflight.appCloseContract.requiredBeforeClosingApp) {
    Write-Host " - $step"
  }
  Write-Host " - workflow proof path: $($preflight.appCloseContract.workflowProofPath)"
  Write-Host " - selected-route-workflow-proof-required until workflow proof validates"
  Write-Host ""
  Write-Host "After the app run:"
  Write-Host " - $($preflight.afterAppCommands.validateWorkflowProof)"
  Write-Host " - $($preflight.afterAppCommands.validateSelectedRouteCompletion)"

  if (-not $SkipLaunch) {
    Write-CommandRecord -Record ([PSCustomObject]@{
        id = "native-dev-launch"
        command = "npm run native:dev"
        outputPath = ""
        exitCode = $null
        startedAt = (Get-Date).ToUniversalTime().ToString("o")
        userGated = $true
        note = "Interactive Tauri desktop launch; cleanup still requires in-app target selection and consent."
      })
    npm run native:dev
    $nativeExitCode = if ($null -eq $LASTEXITCODE) { 0 } else { [int]$LASTEXITCODE }
    $nativeExit = [PSCustomObject]@{
      schemaVersion = "spaceguard-native-dev-exit/v1"
      generatedAt = (Get-Date).ToUniversalTime().ToString("o")
      command = "npm run native:dev"
      exitCode = $nativeExitCode
      success = ($nativeExitCode -eq 0)
      evidenceRoot = $EvidenceRoot
      postAppFinalizationPath = $PostAppFinalizationPath
    }
    Write-JsonFile -Value $nativeExit -Path $NativeDevExitPath
    Write-CommandRecord -Record ([PSCustomObject]@{
        id = "native-dev-exit"
        command = "npm run native:dev"
        outputPath = $NativeDevExitPath
        exitCode = $nativeExitCode
        startedAt = (Get-Date).ToUniversalTime().ToString("o")
        endedAt = (Get-Date).ToUniversalTime().ToString("o")
        userGated = $true
      })

    if ($nativeExitCode -ne 0) {
      Complete-PostAppValidation -Reason "native-dev-failed"
      throw "Native desktop workflow exited with code $nativeExitCode. See $NativeDevExitPath"
    }

    Complete-PostAppValidation -Reason "native-dev-exited"
  } else {
    Write-Host ""
    Write-Host "Skipped launch. Start manually with: npm run native:dev"
    Complete-PostAppValidation -Reason "launch-skipped"
  }
} finally {
  Pop-Location
}
