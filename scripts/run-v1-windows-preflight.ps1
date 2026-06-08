param(
  [string]$EvidenceRoot = "",
  [string]$SelectedRoute = "npm-cache"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([System.Environment]::OSVersion.Platform -ne [System.PlatformID]::Win32NT) {
  throw "The V1 Windows preflight must be run on Windows because cargo test, Tauri bundle output, and proof runners are Windows-targeted."
}

$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot

try {
  $SelectedRoute = $SelectedRoute.Trim()
  if ([string]::IsNullOrWhiteSpace($SelectedRoute)) {
    throw "SelectedRoute is required. Example: npm run v1:preflight -- -SelectedRoute npm-cache"
  }

  $RunStamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss")
  if ([string]::IsNullOrWhiteSpace($EvidenceRoot)) {
    $EvidenceRoot = Join-Path $RepoRoot "evidence\v1-preflight-$RunStamp"
  }

  $CommandLogPath = Join-Path $EvidenceRoot "commands.ndjson"
  $PreflightPath = Join-Path $EvidenceRoot "v1-preflight.json"
  $ReadinessPath = Join-Path $EvidenceRoot "v1-readiness.json"
  $NativeCoveragePath = Join-Path $EvidenceRoot "native-executor-coverage.json"
  $OpenAiFixtureSmokePath = Join-Path $EvidenceRoot "openai-fixture-smoke.txt"
  $OpenAiLiveSmokePath = Join-Path $EvidenceRoot "openai-live-smoke.txt"
  $NativeBundleRoot = Join-Path $RepoRoot "src-tauri\target\release\bundle"
  $NativeBundleEvidenceRoot = Join-Path $EvidenceRoot "native-bundle-artifacts"

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
    }
    Write-CommandRecord -Record $record

    if ($process.ExitCode -ne 0) {
      throw "Command failed: $Id. See $OutputPath"
    }

    return $record
  }

  function Get-NativeBundleArtifacts {
    param([Parameter(Mandatory = $true)][string]$Root)

    if (-not (Test-Path -LiteralPath $Root)) {
      return @()
    }

    $supportedExtensions = @(".exe", ".msi", ".msix", ".zip")
    return @(Get-ChildItem -LiteralPath $Root -Recurse -File | Where-Object {
        $supportedExtensions -contains $_.Extension.ToLowerInvariant()
      } | Sort-Object FullName | ForEach-Object {
        [PSCustomObject]@{
          path = $_.FullName
          fileName = $_.Name
          extension = $_.Extension.ToLowerInvariant()
          bytes = [int64]$_.Length
          modifiedAt = $_.LastWriteTimeUtc.ToString("o")
        }
      })
  }

  function Copy-NativeBundleArtifacts {
    param(
      [Parameter(Mandatory = $true)][string]$Root,
      [Parameter(Mandatory = $true)][string]$EvidenceRoot
    )

    New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
    $index = 0
    return @(Get-NativeBundleArtifacts -Root $Root | ForEach-Object {
        $index += 1
        $evidenceFileName = ("{0:D2}-{1}" -f $index, $_.fileName)
        $evidencePath = Join-Path $EvidenceRoot $evidenceFileName
        Copy-Item -LiteralPath $_.path -Destination $evidencePath -Force
        $hash = Get-FileHash -LiteralPath $evidencePath -Algorithm SHA256
        [PSCustomObject]@{
          path = $_.path
          evidencePath = $evidencePath
          fileName = $_.fileName
          evidenceFileName = $evidenceFileName
          extension = $_.extension
          bytes = [int64](Get-Item -LiteralPath $evidencePath).Length
          sha256 = $hash.Hash.ToLowerInvariant()
          modifiedAt = $_.modifiedAt
        }
      })
  }

  $startedAt = (Get-Date).ToUniversalTime().ToString("o")
  $commands = [PSCustomObject]@{
    jsTests = "npm test"
    nativeExecutorCoverage = "npm run native:executor-coverage"
    rustTests = "cargo test --manifest-path src-tauri\Cargo.toml"
    webBuild = "npm run build"
    v1Readiness = "npm run v1:readiness"
    openAiFixtureSmoke = "npm run openai:smoke:fixture -- --route $SelectedRoute"
    openAiLiveSmoke = "npm run openai:smoke -- --route $SelectedRoute"
    nativeBuild = "npm run native:build"
    nextFirstRoute = "npm run proof:first-route:windows -- -Route temp-fixture"
    nextSelectedRoute = "npm run proof:route:windows -- -Route $SelectedRoute"
  }

  Invoke-LoggedCommand -Id "js-tests" -CommandLine $commands.jsTests -OutputPath (Join-Path $EvidenceRoot "npm-test.txt") | Out-Null
  Invoke-LoggedCommand -Id "native-executor-coverage" -CommandLine $commands.nativeExecutorCoverage -OutputPath $NativeCoveragePath | Out-Null
  Invoke-LoggedCommand -Id "rust-tests" -CommandLine $commands.rustTests -OutputPath (Join-Path $EvidenceRoot "cargo-test.txt") | Out-Null
  Invoke-LoggedCommand -Id "web-build" -CommandLine $commands.webBuild -OutputPath (Join-Path $EvidenceRoot "npm-build.txt") | Out-Null
  Invoke-LoggedCommand -Id "v1-readiness" -CommandLine $commands.v1Readiness -OutputPath $ReadinessPath | Out-Null
  Invoke-LoggedCommand -Id "openai-fixture-smoke" -CommandLine $commands.openAiFixtureSmoke -OutputPath $OpenAiFixtureSmokePath | Out-Null
  Invoke-LoggedCommand -Id "openai-live-smoke" -CommandLine $commands.openAiLiveSmoke -OutputPath $OpenAiLiveSmokePath | Out-Null
  Invoke-LoggedCommand -Id "native-build" -CommandLine $commands.nativeBuild -OutputPath (Join-Path $EvidenceRoot "native-build.txt") | Out-Null
  $nativeBundleArtifacts = Copy-NativeBundleArtifacts -Root $NativeBundleRoot -EvidenceRoot $NativeBundleEvidenceRoot
  if ($nativeBundleArtifacts.Count -lt 1) {
    throw "native-bundle-artifacts-missing: npm run native:build completed but no supported bundle artifacts were found under $NativeBundleRoot"
  }

  $summary = [PSCustomObject]@{
    schemaVersion = "spaceguard-v1-windows-preflight/v1"
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    startedAt = $startedAt
    status = "passed"
    selectedRoute = $SelectedRoute
    evidenceRoot = $EvidenceRoot
    commandLogPath = $CommandLogPath
    artifacts = [PSCustomObject]@{
      v1Preflight = $PreflightPath
      v1Readiness = $ReadinessPath
      nativeExecutorCoverage = $NativeCoveragePath
      openAiFixtureSmoke = $OpenAiFixtureSmokePath
      openAiLiveSmoke = $OpenAiLiveSmokePath
      nativeBundleRoot = $NativeBundleRoot
      nativeBundleEvidenceRoot = $NativeBundleEvidenceRoot
    }
    nativeBundleArtifacts = $nativeBundleArtifacts
    commands = $commands
    nextCommands = @(
      $commands.nextFirstRoute,
      $commands.nextSelectedRoute
    )
    primary = "Windows V1 host preflight passed. Start the seeded first-route proof before npm-cache."
  }

  Write-JsonFile -Value $summary -Path $PreflightPath

  Write-Host ""
  Write-Host "SpaceGuard V1 Windows preflight passed."
  Write-Host "Evidence root: $EvidenceRoot"
  Write-Host "Preflight artifact: $PreflightPath"
  Write-Host ""
  Write-Host "Next commands:"
  foreach ($command in $summary.nextCommands) {
    Write-Host " - $command"
  }
} finally {
  Pop-Location
}
