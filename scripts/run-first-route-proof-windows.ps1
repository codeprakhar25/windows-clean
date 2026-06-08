param(
  [string]$Route = "temp-fixture",
  [string]$EvidenceRoot = "",
  [switch]$SkipLiveOpenAI,
  [switch]$SkipLaunch,
  [switch]$SkipPostAppValidation,
  [switch]$FinalizeOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([System.Environment]::OSVersion.Platform -ne [System.PlatformID]::Win32NT) {
  throw "The first-route proof runner must be run on Windows because the native executor and fixture paths are Windows-only."
}

$Route = $Route.Trim()
$AllowedFirstRouteInputs = @("temp-fixture", "temp", "known-temp-delete")
if ($AllowedFirstRouteInputs -notcontains $Route.ToLowerInvariant()) {
  throw "Unsupported first-route proof route '$Route'. Use temp-fixture for the seeded known-temp-delete proof."
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot

try {
  $RunStamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
  $EvidenceRootProvided = -not [string]::IsNullOrWhiteSpace($EvidenceRoot)
  if ($FinalizeOnly -and -not $EvidenceRootProvided) {
    throw "FinalizeOnly requires -EvidenceRoot pointing at an existing first-route evidence folder."
  }
  if ($FinalizeOnly -and -not (Test-Path -LiteralPath $EvidenceRoot)) {
    throw "FinalizeOnly evidence root does not exist: $EvidenceRoot"
  }
  if ([string]::IsNullOrWhiteSpace($EvidenceRoot)) {
    $EvidenceRoot = Join-Path $RepoRoot "evidence\first-route-proof-$RunStamp"
  }

  $ManifestPath = Join-Path $EvidenceRoot "fixture-manifest.json"
  $BeforeFixturePath = Join-Path $EvidenceRoot "fixture-before-cleanup.json"
  $AfterFixturePath = Join-Path $EvidenceRoot "fixture-after-cleanup.json"
  $ProofPacketPath = Join-Path $EvidenceRoot "first-route-proof-packet.json"
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
  $CompletionCheckPath = Join-Path $EvidenceRoot "first-route-completion-check.json"
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

  function Set-ScopedTempExecutorEnvironment {
    $flags = @(
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

    foreach ($flag in $flags) {
      [System.Environment]::SetEnvironmentVariable($flag, "0", "Process")
    }

    [System.Environment]::SetEnvironmentVariable("SPACEGUARD_ENABLE_TEMP_EXECUTOR", "1", "Process")
    [System.Environment]::SetEnvironmentVariable("SPACEGUARD_ROUTE_SETUP_IGNORE_DOTENV", "1", "Process")
  }

  function Assert-CleanProofExportSlots {
    $staleExports = @()
    foreach ($proofPath in @($SelectedRouteProofPacketPath, $WorkflowProofPath)) {
      if (Test-Path -LiteralPath $proofPath) {
        $staleExports += $proofPath
      }
    }

    if ($staleExports.Count -gt 0) {
      throw "stale-proof-export: Move or archive existing root proof export(s) before starting a new first-route app launch. Use -FinalizeOnly with an existing evidence root after app export. Existing file(s): $($staleExports -join ', ')"
    }
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
      schemaVersion = "spaceguard-first-route-post-app-finalization/v1"
      generatedAt = $startedAt
      reason = $Reason
      evidenceRoot = $EvidenceRoot
      preflightPath = $PreflightPath
      afterFixturePath = $AfterFixturePath
      workflowProofPath = $WorkflowProofPath
      workflowProofExists = Test-Path -LiteralPath $WorkflowProofPath
      skipped = $false
      commands = [PSCustomObject]@{
        inspectAfterCleanup = "powershell -ExecutionPolicy Bypass -File .\scripts\inspect-spaceguard-fixtures.ps1 -ManifestPath `"$ManifestPath`" -AfterCleanupRoute known-temp-delete -EvidencePath `"$AfterFixturePath`""
        validateWorkflowProof = "node scripts\run-workflow-proof-check.mjs --file `"$WorkflowProofPath`""
        validateFirstRouteCompletion = "node scripts\run-first-route-completion-check.mjs --preflight `"$PreflightPath`" --after-fixture `"$AfterFixturePath`" --native-exit `"$NativeDevExitPath`" --workflow-proof `"$WorkflowProofPath`""
      }
      artifacts = [PSCustomObject]@{
        afterFixture = $AfterFixturePath
        workflowProofCheck = $WorkflowProofCheckPath
        firstRouteCompletionCheck = $CompletionCheckPath
        finalization = $PostAppFinalizationPath
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
        command = "inspect fixtures, validate workflow proof, validate first-route completion"
        outputPath = $PostAppFinalizationPath
        exitCode = $null
        startedAt = $startedAt
        userGated = $true
      })

    Invoke-LoggedCommand -Id "inspect-fixtures-after" -CommandLine $summary.commands.inspectAfterCleanup -OutputPath (Join-Path $EvidenceRoot "inspect-fixtures-after.txt") | Out-Null
    Invoke-LoggedCommand -Id "workflow-proof-check" -CommandLine $summary.commands.validateWorkflowProof -OutputPath $WorkflowProofCheckPath | Out-Null
    Invoke-LoggedCommand -Id "first-route-completion-check" -CommandLine $summary.commands.validateFirstRouteCompletion -OutputPath $CompletionCheckPath | Out-Null
  }

  function Write-OperatorAppHandoff {
    $lines = @(
      "# SpaceGuard First-Route App Handoff",
      "",
      "Evidence root: $EvidenceRoot",
      "Preflight bundle: $PreflightPath",
      "",
      "## In-app steps",
      "1. Run real scan in the Tauri desktop app.",
      "2. Select only Seeded temp fixture under %TEMP%\spaceguard-fixture.",
      "3. Arm consent for the current plan and scan fingerprint.",
      "4. Run Real temp cleanup from the first-safe temp executor panel.",
      "5. Run post-run rescan.",
      "6. Export spaceguard-selected-route-proof-packet.md to the repo root.",
      "7. Complete Selected route proof import with reviewer. Import artifact path must be spaceguard-selected-route-proof-packet.md.",
      "8. Re-export spaceguard-selected-route-proof-packet.md to the repo root after import complete.",
      "9. Export spaceguard-real-workflow-proof.md to the repo root before closing the app.",
      "",
      "## Resume validation",
      "npm run proof:first-route:windows:finalize -- -EvidenceRoot `"$EvidenceRoot`"",
      "",
      "## Expected final checks",
      $ValidateWorkflowProofCommand,
      $ValidateFirstRouteCompletionCommand
    )
    Set-Content -LiteralPath $OperatorAppHandoffPath -Value $lines -Encoding UTF8
  }

  Import-SpaceGuardDotEnv -Path (Join-Path $RepoRoot ".env")
  Set-ScopedTempExecutorEnvironment

  if ($FinalizeOnly) {
    Complete-PostAppValidation -Reason "finalize-only"
    Write-Host ""
    Write-Host "Finalized existing first-route evidence root: $EvidenceRoot"
    Write-Host "Completion check: $CompletionCheckPath"
    return
  }
  if (-not $SkipLaunch) {
    Assert-CleanProofExportSlots
  }

  $liveOpenAiConfigured = -not [string]::IsNullOrWhiteSpace([System.Environment]::GetEnvironmentVariable("OPENAI_API_KEY", "Process"))

  Invoke-LoggedCommand -Id "first-route-proof-packet" -CommandLine "node scripts\run-first-route-proof.mjs --route $Route" -OutputPath $ProofPacketPath | Out-Null
  Invoke-LoggedCommand -Id "seed-fixtures" -CommandLine "powershell -ExecutionPolicy Bypass -File .\scripts\seed-spaceguard-fixtures.ps1 -ManifestPath `"$ManifestPath`"" -OutputPath (Join-Path $EvidenceRoot "seed-fixtures.txt") | Out-Null
  Invoke-LoggedCommand -Id "inspect-fixtures-before" -CommandLine "powershell -ExecutionPolicy Bypass -File .\scripts\inspect-spaceguard-fixtures.ps1 -ManifestPath `"$ManifestPath`" -EvidencePath `"$BeforeFixturePath`"" -OutputPath (Join-Path $EvidenceRoot "inspect-fixtures-before.txt") | Out-Null
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

  $InspectAfterCleanupCommand = "powershell -ExecutionPolicy Bypass -File .\scripts\inspect-spaceguard-fixtures.ps1 -ManifestPath `"$ManifestPath`" -AfterCleanupRoute known-temp-delete -EvidencePath `"$AfterFixturePath`""
  $ValidateWorkflowProofCommand = "npm run validate:workflow-proof -- --file .\spaceguard-real-workflow-proof.md"
  $ValidateFirstRouteCompletionCommand = "npm run validate:first-route-completion -- --preflight `"$PreflightPath`" --after-fixture `"$AfterFixturePath`" --native-exit `"$NativeDevExitPath`" --workflow-proof .\spaceguard-real-workflow-proof.md"

  $preflight = [PSCustomObject]@{
    schemaVersion = "spaceguard-first-route-windows-operator/v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    routeInput = $Route
    route = "known-temp-delete"
    evidenceRoot = $EvidenceRoot
    destructiveCommands = $false
    directCleanupCommands = $false
    scopedExecutor = [PSCustomObject]@{
      enabledFlag = "SPACEGUARD_ENABLE_TEMP_EXECUTOR"
      enabledValue = [System.Environment]::GetEnvironmentVariable("SPACEGUARD_ENABLE_TEMP_EXECUTOR", "Process")
      dotenvExecutorFlagsIgnored = [System.Environment]::GetEnvironmentVariable("SPACEGUARD_ROUTE_SETUP_IGNORE_DOTENV", "Process")
      siblingFlagsForcedOff = $true
    }
    openAi = [PSCustomObject]@{
      liveSmokeConfigured = $liveOpenAiConfigured
      liveSmokeSkipped = [bool]($SkipLiveOpenAI -or -not $liveOpenAiConfigured)
    }
    artifacts = [PSCustomObject]@{
      commandLog = $CommandLogPath
      firstRouteProofPacket = $ProofPacketPath
      fixtureManifest = $ManifestPath
      fixtureBeforeCleanup = $BeforeFixturePath
      fixtureAfterCleanup = $AfterFixturePath
      setupDoctor = $SetupDoctorPath
      setupRoute = $SetupRoutePath
      validateRoute = $ValidateRoutePath
      openAiFixtureSmoke = $FixtureSmokePath
      openAiLiveSmoke = $LiveSmokePath
      nativeDevExit = $NativeDevExitPath
      operatorAppHandoff = $OperatorAppHandoffPath
      selectedRouteProofPacket = $SelectedRouteProofPacketPath
    }
    appCloseContract = [PSCustomObject]@{
      schemaVersion = "spaceguard-first-route-app-close-contract/v1"
      workflowProofPath = $WorkflowProofPath
      selectedRouteProofPacketPath = $SelectedRouteProofPacketPath
      expectedWorkflowProofSchema = "spaceguard-real-workflow-proof/v1"
      minimumReclaimedBytes = 1
      nextRouteBlockedUntil = "validate:first-route-completion accepted"
      requiredBeforeClosingApp = @(
        "post-run-rescan-matched",
        "selected-route-proof-packet-exported",
        "selected-route-proof-import-complete",
        "spaceguard-real-workflow-proof-exported"
      )
    }
    userGatedAppSteps = @(
      "Run real scan in the Tauri desktop app.",
      "Select only Seeded temp fixture.",
      "Arm consent for the current plan and scan fingerprint.",
      "Run Real temp cleanup from the first-safe temp executor panel.",
      "Run post-run rescan.",
      "Export, import, then re-export the selected route proof packet.",
      "Export spaceguard-real-workflow-proof.md."
    )
    afterAppCommands = [PSCustomObject]@{
      inspectAfterCleanup = $InspectAfterCleanupCommand
      validateWorkflowProof = $ValidateWorkflowProofCommand
      validateFirstRouteCompletion = $ValidateFirstRouteCompletionCommand
    }
  }

  Write-OperatorAppHandoff
  Write-JsonFile -Value $preflight -Path $PreflightPath
  Invoke-LoggedCommand -Id "validate-first-route-preflight" -CommandLine "node scripts\run-first-route-preflight-check.mjs --file `"$PreflightPath`"" -OutputPath $PreflightCheckPath | Out-Null

  Write-Host ""
  Write-Host "SpaceGuard first-route preflight complete."
  Write-Host "Evidence root: $EvidenceRoot"
  Write-Host "Preflight bundle: $PreflightPath"
  Write-Host "Preflight check: $PreflightCheckPath"
  Write-Host ""
  Write-Host "The runner has not performed cleanup. Continue in the desktop app:"
  foreach ($step in $preflight.userGatedAppSteps) {
    Write-Host " - $step"
  }
  Write-Host ""
  Write-Host "Before closing the app, satisfy app-close proof contract:"
  foreach ($step in $preflight.appCloseContract.requiredBeforeClosingApp) {
    Write-Host " - $step"
  }
  Write-Host " - workflow proof path: $($preflight.appCloseContract.workflowProofPath)"
  Write-Host " - next route remains blocked until: $($preflight.appCloseContract.nextRouteBlockedUntil)"
  Write-Host ""
  Write-Host "After the app run:"
  Write-Host " - $($preflight.afterAppCommands.inspectAfterCleanup)"
  Write-Host " - $($preflight.afterAppCommands.validateWorkflowProof)"
  Write-Host " - $($preflight.afterAppCommands.validateFirstRouteCompletion)"

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
