param(
  [string]$Route = "temp-fixture",
  [string]$EvidenceRoot = "",
  [switch]$SkipLiveOpenAI,
  [switch]$SkipLaunch
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

  Import-SpaceGuardDotEnv -Path (Join-Path $RepoRoot ".env")
  Set-ScopedTempExecutorEnvironment

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
    }
    userGatedAppSteps = @(
      "Run real scan in the Tauri desktop app.",
      "Select only Seeded temp fixture.",
      "Arm consent for the current plan and scan fingerprint.",
      "Run Real temp cleanup from the first-safe temp executor panel.",
      "Run post-run rescan.",
      "Export and import the selected route proof packet.",
      "Export spaceguard-real-workflow-proof.md."
    )
    afterAppCommands = [PSCustomObject]@{
      inspectAfterCleanup = "powershell -ExecutionPolicy Bypass -File .\scripts\inspect-spaceguard-fixtures.ps1 -ManifestPath `"$ManifestPath`" -AfterCleanupRoute known-temp-delete -EvidencePath `"$AfterFixturePath`""
      validateWorkflowProof = "npm run validate:workflow-proof -- --file .\spaceguard-real-workflow-proof.md"
      validateFirstRouteCompletion = "npm run validate:first-route-completion -- --preflight `"$PreflightPath`" --after-fixture `"$AfterFixturePath`" --workflow-proof .\spaceguard-real-workflow-proof.md"
    }
  }

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
  } else {
    Write-Host ""
    Write-Host "Skipped launch. Start manually with: npm run native:dev"
  }
} finally {
  Pop-Location
}
