# SpaceGuard

SpaceGuard is a guarded Windows space recovery assistant. The current app has three working surfaces:

- Browser demo: React + Vite with fixed sample data.
- Native shell: Tauri + Rust read-only scanner for known local roots.
- OpenAI advisor: optional Responses API call from `.env` that interprets the current scan/plan context, suggests next actions without direct tool authority, and records a visible handoff when the user follows a brokered recommendation.

The native scanner measures filesystem metadata. Real cleanup is limited to feature-flagged scoped executors for known temp files, reviewed Downloads items, reviewed large-file archives, reviewed project dependency folders, Gradle cache, user `.cache`, Android cache, shader cache, pip cache, Docker build-cache, npm cache, pnpm store, Recycle Bin, and browser cache; all other routes remain read-only, manual, or advisory.

The product goal is to answer one user question clearly:

> Why is my C drive full, and what can I safely do about it?

## Current Demo

Run the browser demo locally:

```bash
npm run start
```

Then open the local URL Vite prints, usually `http://127.0.0.1:4173`. If that port is occupied, Vite will choose the next available port.

Checks:

```bash
npm run check
npm run setup:doctor
npm test
npm run demo:rehearsal
npm run native:rehearsal
```

`npm run check` builds the production bundle. `npm test` verifies the cleanup guardrails, native scanner adapter, demo/native rehearsal proofs, and shadcn-style React surface. `npm run demo:rehearsal` prints a deterministic no-real-data proof that demo scan, approvals, plan lock, consent, launch guard, simulated ledger, and report-ready rehearsal all pass while real execution stays disabled. `npm run native:rehearsal` prints the same safety proof for synthetic native read-only evidence: current scan fingerprint, measured bytes, native setup readiness, local-only privacy, plan lock, dry-run launch, and no write capability.

## Native Read-Only Scanner

For the full Windows setup and disposable fixture workflow, see [WINDOWS_REAL_DATA_SETUP.md](./WINDOWS_REAL_DATA_SETUP.md). For beta packaging, install/uninstall, support, and evidence handoff rules, see [NATIVE_BETA_DISTRIBUTION.md](./NATIVE_BETA_DISTRIBUTION.md).

Run the desktop shell:

```bash
npm run native:dev
```

Configure the OpenAI advisor:

```bash
cp .env.example .env
# set OPENAI_API_KEY in .env
# optional: set OPENAI_MODEL or OPENAI_REASONING_EFFORT
npm run setup:doctor
npm run proof:first-route
# fastest full private V1 Windows proof; requires live OPENAI_API_KEY smoke:
npm run demo:private-v1-windows -- -SelectedRoute npm-cache
npm run validate:private-v1-proof -- --file evidence/private-v1-proof-npm-cache-YYYYMMDD-HHMMSS/private-v1-proof.json
# lower-level recovery/manual commands:
npm run proof:first-route:windows
npm run openai:smoke:fixture -- --route npm-cache
npm run openai:smoke -- --route npm-cache
npm run setup:route -- --route npm-cache
npm run validate:route -- --route npm-cache
npm run proof:route:windows -- -Route npm-cache
# manual fallback if you skip the selected-route runner:
# npm run native:dev
```

`npm run setup:doctor` is a read-only local setup diagnostic. It reports whether `.env` exists, whether `OPENAI_API_KEY` is configured, which model/reasoning defaults will be used, which scoped executor flags are enabled, and whether the first-route completion proof is accepted. Its `status` is `readonly-ready`, `first-route-proof-required`, `one-route-ready`, or `multi-flag-blocked`; write-mode validation is considered safe to launch only when exactly one scoped executor flag is enabled and non-temp real-data routes have an accepted `SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK`. It does not call OpenAI, scan folders, or run cleanup.

The same JSON now includes `realWorkflow`, a compact route-specific sequence for the next real validation pass: fixture OpenAI smoke, live OpenAI smoke, route setup, route validation, native scan, consent, selected executor, post-run rescan, proof export, Selected route proof import, and only then next-route consideration.

When exactly one scoped executor flag is enabled, `setup:doctor` maps that flag to the matching route alias and prints route-specific OpenAI smoke, `setup:route`, and `validate:route` commands. For example, `SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR=1` prints commands for `--route pnpm-store`, not the npm sample route.

`npm run openai:smoke:fixture -- --route npm-cache` validates the same deterministic fixture task queue and recommendation broker locally without an API key or network call. Pass another route alias, for example `-- --route pnpm-store`, to validate that route's broker path.

`npm run openai:smoke -- --route npm-cache` sends only a fixture context to the OpenAI advisor. It does not scan local folders or run cleanup; use it to validate the `.env` key, model, strict JSON schema, deterministic agent task queue, and recommendation broker before opening the desktop app. The smoke command exits non-zero unless OpenAI returns the required broker-ready recommendation for the selected route fixture.

In `npm run start` / Vite dev, **Ask OpenAI** uses the same-origin `/api/openai-agent/advice` proxy so `OPENAI_API_KEY` stays in the dev server process instead of the browser bundle. In `npm run native:dev`, the desktop app prefers the native `openai_agent_advice` command and reads the same `.env` key from Rust. The legacy `VITE_OPENAI_API_KEY` fallback remains for browser-only experiments, but it exposes the key to the renderer and should not be the normal setup.

`npm run setup:route -- --route npm-cache` prints a read-only route setup packet for one real cleanup path: the required scoped executor flag, native request mode, UI panel id, conflicting flags, route-specific OpenAI smoke commands, and next commands. Run it for the route you plan to validate before launching the desktop shell.

For every route after the seeded temp fixture, `setup:route` stays at `first-route-proof-required` until `SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK` points to an accepted `spaceguard-first-route-completion-check/v1` JSON with positive reclaimed bytes for `known-temp-delete`.

`npm run validate:route -- --route npm-cache` prints the one-route Windows validation packet. It does not scan, call OpenAI, or run cleanup; it lists the exact pre-run checks, forbidden actions, artifacts to capture, native volume proof expectation, selected-route proof packet export/import, and post-run rescan proof required for that route.

`npm run proof:first-route` prints the compact first Windows proof packet for the seeded temp fixture. It combines route-contract audit status, one scoped temp executor flag, fixture seed command, before/after fixture inspection commands, OpenAI smoke/setup/validation commands, app steps, forbidden broad-temp actions, and the positive recovered-byte acceptance rule.

`npm run proof:first-route:windows` is the fastest disposable-VM path for the first real proof. Run it on Windows after setting `.env`; it creates an evidence folder, loads `.env`, forces every scoped executor flag off except `SPACEGUARD_ENABLE_TEMP_EXECUTOR=1`, seeds and inspects the fixture, runs setup doctor, fixture OpenAI smoke, live OpenAI smoke when `OPENAI_API_KEY` is configured, route setup, route validation, writes `operator-preflight.json`, `operator-preflight-check.json`, and `commands.ndjson`, then launches `npm run native:dev`. It does not run cleanup itself; deletion still requires the desktop app's scan, target selection, consent, and executor button. After the app exits, the runner writes `native-dev-exit.json`; a nonzero desktop exit stops proof finalization as `native-dev-failed`. A clean app exit continues into after-cleanup fixture inspection, workflow proof validation, and the first-route completion verifier. Use `-SkipPostAppValidation` only for preflight/dev sessions where the app will not export proof yet.

When the completion verifier accepts that evidence, keep the generated first-route completion check JSON and set `SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK` to that path before enabling `SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR`, `SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR`, or another non-temp route flag.

After first-route proof is accepted, `npm run proof:route:windows -- -Route npm-cache` is the fastest selected-route proof path. It runs only on Windows, loads `.env`, requires `SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK` to point at an accepted `spaceguard-first-route-completion-check/v1` file, resolves route identity through `setup:route` into `selected-route-setup.json`, forces all scoped executor flags off except the selected route flag, runs setup doctor, route-specific OpenAI fixture smoke, live OpenAI smoke when configured, route setup, route validation, writes `operator-preflight.json`, validates it into `operator-preflight-check.json`, writes `operator-app-handoff.md` and `commands.ndjson`, then launches `npm run native:dev`. It does not run cleanup itself; deletion still requires the desktop app's real scan, target selection, consent, executor button, native volume proof, post-run rescan, selected-route proof packet export, selected-route proof import, and workflow proof export. After the app exits cleanly, the runner validates the workflow proof and writes `selected-route-completion-check.json`; that completion artifact is the selected-route handoff for starting the next cleanup route.

`npm run demo:private-v1-windows -- -SelectedRoute npm-cache` coordinates the private V1 Windows proof from the top: selected-route setup validation into `selected-route-setup.json`, host preflight, copied native bundle artifact capture after `npm run native:build` with SHA-256 hashes, seeded first-route proof, accepted first-route completion check binding through `SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK`, first-route root proof export archival into evidence, and selected real-data route proof. It still never performs cleanup directly; it only runs the existing guarded proof runners and writes `private-v1-proof.json` when both route completions are accepted. Private V1 imports `.env`, rejects `-SkipLiveOpenAI`, and fails with `private-v1-openai-key-required` before any proof work starts if `OPENAI_API_KEY` is unavailable; lower-level proof runners can still use fixture-only rehearsals, but the final V1 path requires broker-ready fixture smoke plus live OpenAI smoke for both child route proofs. The coordinator also runs `npm run validate:private-v1-proof -- --file ...` and writes `private-v1-proof-check.json`; rerun that verifier manually if you need to audit or share the captured V1 evidence folder. The final verifier requires selected-route setup evidence, matching private preflight `selectedRoute` evidence, private preflight OpenAI smoke artifacts bound to the selected route, stderr artifacts for the private preflight, first-route proof, and selected-route proof child commands, child OpenAI smoke artifacts with `validation=broker-ready`, a selected-route proof command that uses the selected `-Route`, top-level, private preflight, and child route command ledgers with no direct cleanup commands, required private preflight commands including JS tests, Rust tests, web/native builds, readiness, and OpenAI smoke, plus each child completion's reclaimed bytes, ledger bytes, rescan expected bytes, and rescan remaining bytes so top-level V1 proof cannot accept stale or weak route proof. Replace the selected route when validating another scoped executor, for example `npm run demo:private-v1-windows -- -SelectedRoute gradle-cache`.

Use `-SkipPreflight` only when the same V1 evidence root already contains a passed `private-demo-preflight/private-demo-preflight.json` for the selected route. The coordinator validates that reused preflight proof before starting route cleanup proofs and records the reuse in `commands.ndjson`; the final verifier accepts the skipped preflight command only when it is marked `reused` with reason `SkipPreflightExistingEvidence` and points at the same checked preflight artifact.

If the app proof export is fixed after the selected-route desktop session closes, rerun only the post-app finalization against the existing evidence root:

```bash
npm run proof:route:windows:finalize -- -Route npm-cache -EvidenceRoot evidence/route-proof-npm-cache-YYYYMMDD-HHMMSS
```

To re-check a captured selected-route preflight bundle manually:

```bash
npm run validate:route-preflight -- --file evidence/route-proof-npm-cache-YYYYMMDD-HHMMSS/operator-preflight.json
```

That verifier now requires the captured `selected-route-setup.json`, the `resolve-selected-route` command record, the ready `setup-route.json`, and the selected-route validation packet to agree on the same canonical route and scoped executor flag.

If the app proof export is fixed after the desktop session closes, rerun only the post-app finalization against the existing evidence root:

```bash
npm run proof:first-route:windows:finalize -- -EvidenceRoot evidence/first-route-proof-YYYYMMDD-HHMMSS
```

To re-check a captured preflight bundle manually:

```bash
npm run validate:first-route-preflight -- --file evidence/first-route-proof-YYYYMMDD-HHMMSS/operator-preflight.json
```

After exporting `spaceguard-real-workflow-proof.md`, validate the final handoff artifact:

```bash
npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md
```

The verifier accepts only `spaceguard-real-workflow-proof/v1` packets that are `workflow-proven`, have `readyForNextRoute=true`, include completed selected-route proof import, retain ledger plus matched rescan evidence, and carry the app-close proof contract exported by the desktop app.

For a selected route after `known-temp-delete`, validate the whole route completion chain:

```bash
npm run validate:route-completion -- --preflight evidence/route-proof-npm-cache-YYYYMMDD-HHMMSS/operator-preflight.json --native-exit evidence/route-proof-npm-cache-YYYYMMDD-HHMMSS/native-dev-exit.json --workflow-proof spaceguard-real-workflow-proof.md
```

This completion verifier reads the selected-route preflight bundle, `commands.ndjson`, native app exit evidence, selected-route proof packet, and workflow proof. It requires successful records for `validate-selected-route-preflight`, `native-dev-launch`, `native-dev-exit`, `finalize-after-app`, and `workflow-proof-check`, verifies that ledger rows, rescan rows, and workflow proof all bind to the same route and reclaimed byte count, then reports whether the next route may start.

For the seeded first route, also validate the whole preflight plus after-cleanup fixture plus workflow proof chain:

```bash
npm run validate:first-route-completion -- --preflight evidence/first-route-proof-YYYYMMDD-HHMMSS/operator-preflight.json --after-fixture evidence/first-route-proof-YYYYMMDD-HHMMSS/fixture-after-cleanup.json --native-exit evidence/first-route-proof-YYYYMMDD-HHMMSS/native-dev-exit.json --workflow-proof spaceguard-real-workflow-proof.md
```

This completion verifier also reads the preflight bundle's `commands.ndjson` and requires successful post-app records for `native-dev-launch`, `native-dev-exit`, `finalize-after-app`, `inspect-fixtures-after`, and `workflow-proof-check`.

The same `.env` file can hold named scoped executor flags, for example `SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR=1`, when you are validating real cleanup on Windows. Validate and run one selected route at a time, then complete post-run rescan proof before running another executor.

For any scoped route after `known-temp-delete`, the same `.env` must also set `SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK` to the accepted first-route completion check JSON. Without that file, setup doctor, route setup, and route validation keep the route blocked even when exactly one executor flag is enabled.

After a scoped native route finishes and the post-run rescan matches, export **Selected route proof packet** and paste the `spaceguard-selected-route-proof-packet/v1` markdown or JSON into **Selected route proof import** under Validation evidence. With reviewer and artifact path filled, it maps only to `ledger-rescan-parity`; demo or dry-run proof is rejected.

When an OpenAI recommendation routes a user-clicked executor, the app shows **Latest agent handoff** with the recommendation, broker status, deterministic route, checks, ledger row count, and reclaimed bytes. If the native executor accepts the request, the execution ledger is annotated with `OpenAI handoff` and the native write response includes a before/after drive free-space volume proof from the OS probe.

Enable temp cleanup only on a disposable Windows validation machine or after you accept the temp-file risk:

```powershell
$env:SPACEGUARD_ENABLE_TEMP_EXECUTOR="1"
npm run native:dev
```

Enable reviewed project dependency cleanup for stale `node_modules` targets:

```powershell
$env:SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR="1"
npm run native:dev
```

Enable old-file cleanup under the current user's Gradle cache:

```powershell
$env:SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR="1"
npm run native:dev
```

Enable old-file cleanup under the exact current user's `.cache` root:

```powershell
$env:SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR="1"
npm run native:dev
```

Enable old-file cleanup under scanned Android Studio cache roots:

```powershell
$env:SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR="1"
npm run native:dev
```

Enable old-file cleanup under scanned graphics shader cache roots:

```powershell
$env:SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR="1"
npm run native:dev
```

Enable old-file cleanup under the current user's pip cache:

```powershell
$env:SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR="1"
npm run native:dev
```

Enable Docker build-cache cleanup through the allowlisted Docker builder prune command:

```powershell
$env:SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS="1"
npm run native:dev
```

Enable old-file cleanup under the current user's npm `_cacache`:

```powershell
$env:SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR="1"
npm run native:dev
```

Enable permanent Recycle Bin emptying for the selected drive:

```powershell
$env:SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR="1"
npm run native:dev
```

Enable browser cache cleanup for scanned cache roots:

```powershell
$env:SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR="1"
npm run native:dev
```

Build the desktop app:

```bash
npm run native:build
```

Windows development prerequisites:

- Node.js and npm.
- Rust with the MSVC toolchain.
- Microsoft C++ Build Tools with "Desktop development with C++".
- Microsoft Edge WebView2 Runtime, already present on most Windows 10/11 systems.

Linux development requires the normal Tauri WebView system packages. On this machine, `cargo check --manifest-path src-tauri/Cargo.toml` could download crates but stopped before compiling the app because `pkg-config` and `dbus-1` development files are missing.

The native command exposed to the frontend is:

```txt
scan_known_roots
```

The native dry-run executor command is:

```txt
simulate_cleanup_plan
```

It returns ledger entries plus a bounded metadata-only candidate manifest for first-safe routes. Candidate enumeration first reuses the native target allowlist/forbidden-target checks; rejected target scopes return no file samples. It reports `realRunEnabled: false`, records sampled candidate bytes and skipped counts, and does not mutate the filesystem.

The native write-boundary command is:

```txt
execute_cleanup_plan
```

It validates request shape for dry-run probes and contains scoped real executor branches for `requestMode=execute-first-safe`, `requestMode=execute-project-deps`, `requestMode=execute-downloads-recycle-bin`, `requestMode=execute-large-file-archive`, `requestMode=execute-gradle-cache`, `requestMode=execute-user-cache`, `requestMode=execute-android-cache`, `requestMode=execute-shader-cache`, `requestMode=execute-pip-cache`, `requestMode=execute-docker-build-cache`, `requestMode=execute-npm-cache`, `requestMode=execute-pnpm-store`, `requestMode=execute-recycle-bin`, and `requestMode=execute-browser-cache`.

For `known-temp-delete`, setting `SPACEGUARD_ENABLE_TEMP_EXECUTOR=1` in `.env` or the Windows Tauri process environment enables deletion of old files under allowlisted temp roots only. When a native scan sees the seeded `%TEMP%\spaceguard-fixture` files, the app adds a non-default **Seeded temp fixture** action targeting only `%TEMP%\spaceguard-fixture` and disables broad temp auto-selection for that run. Use that fixture action as the first real executor proof before selecting broad temp cleanup. The executor rejects missing plan/scan/consent IDs, non-Windows runtimes, non-temp routes, forbidden targets, symlinks, recent files, folders, and broad personal/project paths. It returns a ledger-style native response with accepted state, bytes reclaimed, skipped count, and warnings. Without the feature flag, it still rejects with zero bytes.

For `known-temp-delete`, the native response exposes an executor scaffold: route `known-temp-delete`, feature flag `tempCleanupExecutor`, and whether mutation is enabled in the current runtime.

For `node-modules-old`, setting `SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR=1` enables reviewed dependency cleanup. The frontend sends only item-review targets marked **Remove**. The native executor accepts only `node_modules` directories whose parent has `package.json`, skips link-like entries, removes files through controlled traversal, removes empty directories bottom-up, and never runs package-manager or shell commands. Native review items parse readable `package.json` metadata for package name, package manager or lockfile, framework hints such as Expo/React Native/Next/Vite, and common scripts so stale dependency folders can be reviewed with better context.

For `downloads-installers`, setting `SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR=1` enables reviewed Downloads cleanup. The frontend sends only item-review targets marked **Remove**. The native executor accepts only single non-symlink installer/archive files under the current user's Downloads folder, requires the file to be at least 30 days old, moves accepted files through Windows Shell Recycle Bin semantics with `SHFileOperationW`, rejects directories and arbitrary personal folders, and never runs shell commands.

For `large-user-files`, setting `SPACEGUARD_ENABLE_LARGE_FILE_ARCHIVE_EXECUTOR=1` enables reviewed large-file archive. The frontend sends only item-review targets marked **Move** or **Archive** plus an explicit archive destination. The native executor accepts only single non-symlink 1GB+ files under current-user review folders, requires the file to be at least 90 days old, requires an existing non-system destination on another drive, copies into a plan-specific `SpaceGuard Archive` folder, verifies the copied size, removes the source file, rejects bulk folders and same-drive destinations, and never runs shell commands.

For `gradle-cache`, setting `SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR=1` enables bounded Gradle cache cleanup. The frontend sends only the concrete `.gradle\caches` path from the latest native read-only scan. The native executor accepts only the current user's `.gradle\caches` directory, deletes files older than 30 days, skips symlinks, lock files, recent files, daemon state, wrapper files, init scripts, project folders, `node_modules`, and Program Files paths, removes empty cache subdirectories bottom-up, and never runs Gradle or shell commands.

For `user-cache`, setting `SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR=1` enables bounded user `.cache` cleanup. The frontend sends only the concrete `%UserProfile%\.cache` path from the latest native read-only scan. The native executor accepts only the current user's exact `.cache` directory, deletes files older than 30 days, skips symlinks, recent files, config files, databases, lock files, logs, sessions, credentials, identity-like files, project folders, `node_modules`, Program Files paths, and system paths, removes empty cache subdirectories bottom-up, and never runs shell commands.

For `android-cache`, setting `SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR=1` enables bounded Android cache cleanup. The frontend sends only scanned Android Studio `caches`, `system\caches`, or `%UserProfile%\.android\build-cache` paths from the latest native read-only scan. The native executor deletes files older than 30 days, skips symlinks, recent files, lock/config/database/session/credential-like files, rejects `.android\avd`, SDKs, emulators, Gradle data, project folders, Program Files paths, and system paths, removes empty cache subdirectories bottom-up, and never runs Android Studio, SDK tools, or shell commands.

For `steam-shader-cache`, setting `SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR=1` enables bounded shader cache cleanup. The frontend sends only scanned `%LocalAppData%\D3DSCache`, NVIDIA `DXCache`/`GLCache`/`NV_Cache`, AMD `DxCache`/`GLCache`/`VkCache`, and Intel `ShaderCache` roots from the latest native read-only scan. The native executor deletes files older than 14 days, skips symlinks, recent files, config/database/session/credential-like files, rejects game install folders, save-data paths, launcher profiles, package folders, Program Files paths, and system paths, removes empty cache subdirectories bottom-up, and never runs launchers, graphics tools, or shell commands.

For `pip-cache`, setting `SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR=1` enables bounded pip cache cleanup. The frontend sends only the concrete `%LocalAppData%\pip\Cache` path from the latest native read-only scan. The native executor deletes files older than 14 days, skips symlinks, recent files, lock/config/database/session/credential-like files, rejects Python installs, virtualenvs, site-packages, pip config, selfcheck data, Program Files paths, and system paths, removes empty cache subdirectories bottom-up, and never runs pip, Python, or shell commands.

For `docker-build-cache`, setting `SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS=1` enables Docker build-cache cleanup only after the native read-only scan successfully inventories Docker with `docker system df -v`. The frontend sends only the `Docker Desktop build cache` inventory target. The native executor runs exactly `docker builder prune --force` through `Command::new("docker")`, parses `Total reclaimed space`, and rejects Docker volumes, running containers, image prune, Docker data-root folders, arbitrary paths, PowerShell, shell commands, and broad `docker system prune` routes.

For `npm-cache`, setting `SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR=1` enables bounded npm cache cleanup. The frontend sends only the concrete `%LocalAppData%\npm-cache\_cacache` path from the latest native read-only scan. The native executor accepts only the current user's `_cacache` directory, deletes content blobs and cache temp files older than 14 days, keeps npm index metadata, skips symlinks, recent files, global packages, project `node_modules`, Program Files paths, and system paths, removes empty cache subdirectories bottom-up, and never runs npm or shell commands.

For `pnpm-store`, setting `SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR=1` enables bounded pnpm store cleanup. The frontend sends only the concrete `%LocalAppData%\pnpm\store` path from the latest native read-only scan. The native executor accepts only the current user's pnpm store directory, deletes content and temp files older than 30 days, keeps store metadata, skips symlinks, recent files, global bins, project `node_modules`, Program Files paths, and system paths, removes empty cache subdirectories bottom-up, and never runs pnpm or shell commands.

For `recycle-bin`, setting `SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR=1` enables Shell Recycle Bin emptying for the selected drive. The frontend sends only the concrete Recycle Bin path from the latest native read-only scan, requires the app's permanent-removal confirmation, and adds `permanentRemovalConfirmed=true` to the native request. The native executor derives the drive root, calls `SHQueryRecycleBinW` before/after, calls `SHEmptyRecycleBinW` with no shell prompt/progress UI, records reclaimed bytes, and never accepts Downloads/Documents or arbitrary folder paths.

For `browser-cache`, setting `SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR=1` enables browser cache cleanup. The frontend sends only concrete cache root paths from the latest native read-only scan. The native executor accepts cache folders such as Chromium `Cache`, Chromium `Cache_Data`, Chromium `Code Cache`, and Firefox `cache2`; it rejects cookies, sessions, saved logins, extensions, history, bookmarks, preferences, favicons, profile databases, symlinks, non-directories, and non-cache paths. It removes files through controlled traversal, removes empty cache subdirectories bottom-up, skips recently modified files, and never runs shell commands.

Each rejected write entry also carries native preflight evidence: request-shape checks, target allowlist status, mutation lock, route feature-flag state, and validation-evidence state. Preflight rows show what would block or pass before a future executor runs; they do not create cleanup authority.

The **Write boundary probe** panel can call this rejecting command from the desktop shell. A passing probe is rejection evidence only: accepted is false, every entry is rejected, reclaimed bytes are zero, and no ledger or recovery claim is created.

The **First-safe validation gate** sits between the disabled request contract and the write-boundary probe. It summarizes the selected first-safe route, required Windows validation checks, required fixtures, contract status, and runtime write signals. Passing this gate means implementation planning can start; it still reports real run allowed as false and keeps destructive actions hidden.

The **First-safe work order** turns a passed validation gate into an engineering checklist for the next executor: native implementation boundary, target allowlist, forbidden-target rejection, disposable fixture tests, rollback/rescan proof, feature flag, and kill-switch review. It is not a cleanup command and still reports real run allowed as false.

The **Temp executor activation** gate is the route-specific bridge for the known-temp executor. It requires the known-temp route, native preflight rows, the `tempCleanupExecutor` flag, validation gate, work order, release gate, and write readiness. When the flag is off, activation remains disabled with zero bytes; when the flag is on, the native executor still requires current plan, scan fingerprint, consent, route, and target validators.

The **Temp activation rehearsal** panel is a browser-safe demo of that same route. It synthesizes rejected write-boundary evidence from the current first-safe contract, feeds it through the real activation gate, and should stop at `feature-flag-disabled`. It is demo-only evidence: no native command runs, no local path is scanned, no mutation is attempted, and it cannot satisfy Windows validation or release readiness.

The **Real data launch roadmap** panel consolidates product status and rough delivery ranges. It separates the web demo, native read-only beta, scoped native executors, and broader cleanup product milestones. It is evidence tracking only: estimates do not unlock cleanup routes, and runtime flags still decide which named executors can run.

The **Native beta distribution** panel separates read-only beta packaging from real cleanup. It requires a current native read-only scan, local-only privacy, release/setup docs, install/uninstall path, redacted support workflow, signing or SmartScreen evidence, and no real-cleanup claim before native beta can be called ready.

The **OpenAI cleanup agent** panel sends a bounded context packet to the OpenAI Responses API when the user clicks **Ask OpenAI**. In the desktop shell, the renderer invokes the native `openai_agent_advice` command; Rust reads `OPENAI_API_KEY` from the process environment or local `.env`, builds the strict Responses API request, and returns structured advice without exposing the secret to the webview. In Vite dev, the renderer calls `/api/openai-agent/advice`; the Vite server reads the same `.env` key and returns only normalized advice. Browser-only demos can still use the legacy `VITE_OPENAI_API_KEY` fallback, but that exposes the key to the renderer. The advisor defaults to `OPENAI_MODEL=gpt-5.2` and supports `OPENAI_REASONING_EFFORT` for Responses API reasoning settings. It includes scan status, current plan identity, selected actions, candidate samples, advisory project dependency review candidates such as stale Expo or React Native `node_modules`, reviewed project dependency executor targets, scanned Gradle, user `.cache`, Android, shader, pip, Docker build-cache, npm, and pnpm cache/store evidence, scanned browser cache roots, manual installed-app review targets, installed-app source coverage counts, broad drive inventory rows, custom-root triage rows, executor readiness, consent match, scan fingerprint presence, first-route completion state, post-run proof state, and runtime capability flags. The context also includes a deterministic agent task queue that ranks scan-derived executor, review, and manual-only tasks before the model responds; recommendations must copy those task `actionType`, `targetId`, and `route` values to become brokerable. Responses use a strict JSON schema with a bounded action vocabulary, so the app can display ranked next actions, blockers, questions, and warnings predictably. Successful advice calls write a compact local advisory run record with plan id, provider metadata, recommendation rows, proof status, and redacted context counts; it does not persist the API key, raw model text, raw scan fingerprint, or full local path context. Recommended executor actions render as user-clickable buttons in both the OpenAI panel and the **Real cleanup command flow**, but the click still routes through the same native feature flags, consent receipt, scan fingerprint, first-route proof blocker, proof-state blocker, target validators, and UI preconditions. Project dependency review candidates can only become executor targets after the user marks exact items Remove in the deterministic review UI. Manual discovery targets can only produce review guidance; they cannot become automated uninstall, direct folder deletion, shell, registry-edit, or partition actions. It does not grant the model filesystem access, approval authority, shell execution, or delete/move/archive authority.

The **App uninstall work order** turns selected installed-app footprint candidates into a manual follow-up artifact. It records the app name, path, measured footprint, publisher/version/install-date signals when available, usage-proof state, uninstall-entry evidence, and the exact guardrails: no automated uninstall, no uninstall-string execution, no Program Files deletion, no registry edits, and no recovered-space claim until a native rescan verifies the footprint changed.

The **WSL compaction work order** turns scanned `ext4.vhdx` findings into a manual advanced checklist. It records measured VHDX targets, typed acknowledgement state, backup/export, WSL shutdown, manual compaction, boot verification, and native rescan requirements. SpaceGuard does not run `wsl.exe`, PowerShell, `Optimize-VHD`, partition tools, or VHDX deletion.

The native runtime capability command is:

```txt
runtime_capabilities
```

It reports platform, scanner availability, dry-run availability, and whether real executors are enabled.

Runtime capabilities also expose per-executor feature flags: `tempCleanupExecutor`, `downloadsCleanupExecutor`, `largeFileArchiveExecutor`, `projectDependencyExecutor`, `gradleCacheExecutor`, `userCacheExecutor`, `androidCacheExecutor`, `npmCacheExecutor`, `pnpmStoreExecutor`, `recycleBinExecutor`, `browserCacheExecutor`, and `toolNativePruneExecutors`. They default to false independently, so enabling temp, reviewed Downloads, reviewed large-file archive, project dependency, Gradle cache, user `.cache`, Android cache, npm cache, pnpm store, Recycle Bin, or browser cache cleanup cannot accidentally enable unrelated cleanup routes.

It currently scans or reports:

- Top-level target-drive inventory as capped read-only context.
- `%TEMP%` and `C:\Windows\Temp`
- Recycle Bin
- `C:\Windows.old`
- Gradle cache
- npm `_cacache`
- pnpm store
- Downloads installers and archives
- Large personal files under user folders
- Browser cache roots only
- Android Studio cache roots
- WSL `ext4.vhdx` files
- `node_modules` folders under common project roots such as `Code`, `dev`, `Projects`, `repos`, and `workspace`
- Installed app footprints under Program Files, ProgramData, and LocalAppData\Programs
- `hiberfil.sys` and `pagefile.sys` as advanced/blocked visibility

The scanner returns explicit `missing`, `measured`, `limited`, `protected`, or `unsupported` statuses so native mode does not silently reuse demo sizes for unknown roots.

The scan coverage panel turns those statuses into a confidence score. Demo-estimated, missing, protected, or unsupported roots stay visible as unverified coverage gaps; they cannot be treated as proven real-data cleanup evidence.

The real scan settings panel controls the next native read-only scan:

- Target drive for volume totals and Windows system roots.
- Project artifact inclusion for old `node_modules` discovery.
- Traversal depth.
- Per-root entry cap.

Changing these settings clears previous native scan evidence and dry-run state so reports do not mix old measurements with new scanner limits. Target drive accepts a Windows drive letter such as `C:` or `D:`; native volume totals and system roots follow that drive, while user-profile cache roots remain tied to the current Windows profile.

For review-gated roots, the scanner can also return item-level candidates:

- Top installer/archive files under Downloads.
- Top large personal files under Downloads, Desktop, Documents, and Videos.
- Individual `node_modules` roots under common project folders.
- Top Android Studio cache or emulator entries.
- Large installed app footprints for manual uninstall review, enriched with read-only Windows uninstall metadata when available.

These candidates are metadata-only. Large personal files and installed app footprints are discovery-only until the user makes per-item decisions. Installed app folder modification age is a weak hint, not proof of usage. When Windows uninstall metadata is available, SpaceGuard reads display name, publisher, display version, install location, install date, estimated size, and whether an uninstall entry exists; it does not store or run uninstall command strings. When Windows UserAssist launch-history names are available, SpaceGuard correlates them read-only against app folder/display names and marks matching apps as having launch evidence. Missing UserAssist evidence is still only a review signal, not proof that an app is unused. The installed-app finding now includes `metadataSources` and `evidenceSummary` so the UI and OpenAI context can distinguish "UserAssist was scanned and no match was found" from "usage source unavailable." App review items also carry structured signals such as usage proof, registry match, publisher, install date, uninstall entry, measured size, and official manual action so the UI and OpenAI advisor can reason over explicit evidence instead of parsing prose. The app uninstall review dossier ranks those candidates, shows missing usage proof explicitly, preserves source coverage counts, assigns a conservative unused-review score with score factors, and tracks manual uninstall follow-up bytes without creating executor recovery. App cleanup stays manual through Windows Settings or the vendor uninstaller; SpaceGuard does not delete Program Files folders or run uninstallers.

## Product Shape

SpaceGuard is not a generic PC optimizer. It is a guarded workflow:

1. Scan a Windows drive.
2. Classify raw paths into known cleanup recipes.
3. Rank actions by recoverable space and risk.
4. Ask for the correct approval gate.
5. Execute only allowed actions.
6. Rescan and produce a cleanup ledger.

The planner includes recipes for Windows temp files, Recycle Bin, Windows.old, Gradle, pip, npm, pnpm, Docker build cache, WSL virtual disks, Android Studio, old `node_modules`, Downloads, large personal file discovery, shader cache, browser cache, hibernation, pagefile, and partition strategy.

The demo also includes:

- Scenario presets for developer, gaming, and family laptops.
- Real data readiness panel for the Tauri read-only scanner.
- Windows setup assistant that separates browser demo, desktop shell, current read-only scan evidence, local privacy/export, native beta readiness, and the real-cleanup lock.
- Real data launch roadmap with current milestone, progress, rough estimate, confidence, demo/native activation proof, native evidence quality, and real-cleanup lock status.
- Native beta distribution readiness for signing, setup docs, install/uninstall, support workflow, read-only scan evidence, no-cleanup claims, and exportable beta evidence records.
- OpenAI cleanup agent panel for advisory ranking, next-step suggestions, blocked-action explanations, and user questions from real scan context.
- Real cleanup command flow that combines scan, consent, user-selected scoped executor route, OpenAI recommendation follow-through, execution, and post-run rescan proof in one operator surface.
- Executor smoke-run packet for the selected scoped route, feature flag, request mode, consent, scan fingerprint, post-run proof state, and proof export checklist. When multiple selected routes are ready, the packet marks one active smoke route and queues the other ready routes behind post-run proof.
- First-safe temp executor panel for old files under allowlisted temp roots, feature-flagged in the Windows native runtime.
- Recycle Bin executor panel for permanent Shell Recycle Bin emptying, requiring the permanent-removal confirmation gate and native request acknowledgement.
- Gradle cache executor panel for old files under the current user's `.gradle\caches` root, with project folders and Gradle daemon/wrapper/config paths rejected.
- User `.cache` executor panel for old files under the exact current user's `%UserProfile%\.cache` root, with config, database, session, credential, identity-like, and project paths rejected.
- npm cache executor panel for old content blobs and temp files under `%LocalAppData%\npm-cache\_cacache`, with index metadata, globals, and project folders rejected.
- pnpm store executor panel for old content and temp files under `%LocalAppData%\pnpm\store`, with store metadata, global bins, shell commands, and project folders rejected.
- Reviewed Downloads executor panel for selected old installer/archive files under the current user's Downloads folder, moved through Recycle Bin semantics only.
- Reviewed large-file archive executor panel for selected old 1GB+ personal files marked Move or Archive, copied to an explicit destination on another drive and then removed from the source only after copy verification.
- Reviewed project dependency executor panel for stale `node_modules` cleanup, including Expo/React Native project hints and item-level remove targets.
- Browser cache executor panel for scanned cache roots only, with cookies, sessions, logins, extensions, history, and profile stores blocked by native target validation.
- Installed app footprint review and app uninstall dossier for large app folders, with manual uninstall guidance and no automated uninstall or Program Files deletion.
- Demo rehearsal runbook that proves the browser demo can go from scan to gated plan, dry-run consent, simulated ledger, and report export without native data or real cleanup.
- Product completion audit that maps the original product requirements to proven, partial, waiting, locked, or unsafe evidence so the app cannot overclaim real cleanup readiness.
- Safety interlock that summarizes runtime write signals, native write signals, scan freshness, dry-run consent, task power leases, standing permission, run readiness, write-boundary evidence, release review, and write readiness into one stop/hold/dry-run state.
- Dry-run launch guard that blocks simulation unless run readiness, current consent, and the safety interlock all pass while real execution remains locked.
- Operating checklist that collapses scan evidence, active user question, run readiness, consent, launch guard, ledger state, and the real-cleanup lock into one safe-next-action surface.
- Native Windows volume evidence for target-drive total, used, and free bytes when the desktop scanner can read it.
- Read-only drive inventory for top-level target-drive entries so broad C-drive pressure is visible before any cleanup recipe or custom-root decision.
- Storage pressure diagnosis that answers why the target drive is full, ranks causes, and chooses the next safe workflow branch without granting cleanup authority.
- Native evidence quality gate that grades current read-only scan freshness, measured coverage, inventory, diagnosis, privacy, and mutation lock before real-data planning.
- Intake constraints for target drive, goal, risk tolerance, protected paths, and whether admin/system routes can enter dry-run planning.
- Risk budget gate that blocks dry-run simulation when selected actions exceed Safe, Balanced, or Emergency mode limits.
- Plan lock that binds the current plan snapshot to the scan fingerprint, selected rows, risk budget, and dry-run consent so stale consent cannot launch.
- Task powers panel that maps selected cleanup actions to scoped capabilities such as safe cleanup, rebuildable cache cleanup, reviewed item cleanup, admin cleanup, advanced system strategy, manual storage strategy, and restricted zones.
- Task grant receipts that bind each selected action to a dry-run-only authority, route, target, plan id, scan fingerprint, consent receipt, allowed operations, forbidden operations, and blockers.
- Task runbook panel that turns each selected cleanup target into a task-scoped work order with the next user question, allowed operations, forbidden operations, evidence needs, and no cross-task authority.
- Restriction matrix that makes hard-blocked, manual-only, review-gated, intake-gated, and future-disabled cleanup classes visible with allowed and forbidden operations.
- Real scan settings for target drive, project artifact inclusion, traversal depth, per-root entry caps, and custom read-only roots.
- Scan session freshness guard that fingerprints target drive, custom roots, traversal caps, project-artifact setting, and protected paths, then blocks preflight when native evidence is stale.
- Scan coverage confidence showing measured, limited, unsupported, missing, custom-root, and demo-estimated cleanup roots.
- Custom root discovery that measures user-entered folders read-only for manual review and never creates executor routes.
- Custom root triage for unknown folders, with Keep, Archive, Move, Inspect, or Escalate dispositions stored locally as manual evidence and never counted as automated cleanup.
- Runtime privilege boundary that shows whether the desktop shell is elevated and which selected routes would need admin validation later.
- Recovery advisor that explains the next useful move when the target is unmet.
- Agent questions panel that turns scan state, approvals, review items, consent, validation evidence, and verification into the next user-facing question.
- Agent questions also ask whether to allow admin/system dry-run routes when lower-risk cleanup is exhausted and admin-sensitive recovery remains intake-gated.
- User decision receipt that records selected tasks, cache/permanent approvals, item-level review choices, protected path count, admin intake, dry-run consent, active question, and the real-run lock.
- Storage strategy panel for manual app uninstall, archive, library move, drive upgrade, or partition planning when cleanup cannot hit the target.
- Manual strategy checklist that lets the user track backup, archive, app-native move, uninstall, and partition-prep evidence without automation.
- Review workbench that separates measured evidence, unresolved decisions, protected paths, and unsupported roots.
- Item review panel for Downloads, large files, old project dependencies, Android Studio roots, and installed app footprints, with per-item decisions. For apps, Mark uninstall is manual follow-up only.
- Decision log for source, scan, plan, gates, policy, and execution state.
- Decision log and dry-run reports include the selected task powers, task grant receipts, waiting power gates, locked admin powers, and real-run-disabled boundary.
- Power broker panel that turns selected task powers into current-plan power requests, preserves the active user question, refuses standing permission, and keeps each request dry-run only.
- Power lease audit that checks issued task grants against the current plan id, scan fingerprint, dry-run consent, broker request, and runtime write lock before any dry-run work order is treated as current.
- Executor policy panel that classifies selected routes before simulation.
- Native candidate manifest preview that shows target-scope status, sampled dry-run file metadata, target path, and skipped counts without deleting anything.
- Native dry-run scope evidence export that runs a metadata-only allowed/rejected scope probe and writes a minimal JSON artifact for fixture validation without raw candidate filename samples.
- Executor manifest panel that shows every route family, first-safe lanes, required validation checks, fixtures, preconditions, rollback notes, and next implementation steps.
- Tool command inventory panel that lists official inspect/prune command shapes for npm, pnpm, Docker, Gradle, and Windows cleanup without executing shell commands.
- Release gate panel that shows per-executor feature flags, runtime capabilities, missing validation checks, and disposable VM coverage.
- Write boundary probe panel that records native rejection evidence for the future write request shape without counting recovered space.
- First-safe executor contract panel that previews the disabled request shape for known temp, Recycle Bin, or browser cache routes without enabling writes.
- Local validation evidence ledger and pack export with Windows VM scenarios, fixture roots, required checks, reviewer/artifact records, command checklist, fixture-evidence import, and signoff fields.
- Agent questions that guide scan, approvals, item review, dry-run consent, simulation, rescan parity, rollback proof, fixture import, validation details, and write-boundary probe without marking proof complete on their own.
- User-defined protected paths that remove matching actions from executable plans.
- A plan review queue separating ready, pending, protected, and policy-blocked work.
- An execution preflight checklist that blocks simulation until scan, selection, gates, protected paths, and ledger state are valid.
- Run readiness that also requires executor-policy clearance, at least one dry-run route, and real deletion still locked.
- Permanent-removal confirmation for Recycle Bin emptying, separate from cache approval.
- A plan-specific dry-run consent receipt that must be armed after readiness passes and resets whenever the plan snapshot changes.
- Plan snapshot verification so a ledger is trusted only when it matches the current selected actions, approvals, protected paths, and item decisions.
- Post-run verification checklist that turns the current ledger into affected-root rescan checkpoints before any Windows validation can count, with a dedicated **Run post-run rescan** action that preserves the ledger and compares against the execution snapshot that produced it.
- Execution proof handoff panel that appears with the scoped executor workflow and makes the next required post-run proof step explicit: current run type, reclaimed bytes, checkpoints, post-run scan timing, parity counts, and the ledger-preserving **Run post-run rescan** action.
- Scoped executor handlers and OpenAI recommendation broker checks refuse a second scoped execution while the current ledger is still in `proof-required`, `proof-review`, or `proof-mismatch` state.
- Scoped executor run gate that blocks direct panel clicks for queued ready routes; only the smoke packet's active route can reach a native executor handler.
- OpenAI executor recommendations must pass an action-route match check: the model-provided route is retained for audit, but the UI selects the broker's deterministic executor route before any scoped run can start.
- Rollback plan panel and local proof ledger that classify each selected executor route as rebuildable, restore-path-required, backup-required, permanent-warning, or blocked, then require reviewer, evidence path, and restore/backup/acknowledgement reference for proof routes.
- Local run history that persists dry-run and scoped executor ledger records on the device and separates current-plan records from stale audit evidence.
- Privacy boundary panel that explains local scan metadata, manual exports, local audit storage, blocked data classes, and disabled telemetry/cloud upload.
- Public beta readiness panel that separates web-demo readiness from native read-only beta readiness, including signing, support, uninstall, privacy, and claim boundaries.
- Redacted support bundle export for diagnostics that excludes local paths and filenames by default.
- Workflow handoff export that captures the active question, next resume actions, product audit state, and real-cleanup lock without local paths.
- Beta handoff manifest that labels required exports as public-safe, support-safe, internal evidence, or path-level before any beta sharing.
- Local evidence backup export/import for validation, rollback, manual strategy, custom-root triage, native beta evidence, and run history only.
- Release review packet that combines scan session, task grants, first-safe contract, write-boundary rejection, validation, rollback, rescan, privilege, privacy, support redaction, public claims, and real-cleanup lock evidence.
- A dry-run report export with selected actions, locked actions, pending gates, advisor state, decision log, and simulated ledger entries.

## Guardrail Policy

Allowed in low-risk batch:

- Known temporary files.
- Browser cache only, never identity data.

Requires confirmation:

- Rebuildable tool caches.
- Windows.old.
- Docker build cache.
- Game launcher shader/download caches.

Requires permanent-removal confirmation:

- Recycle Bin emptying.

Requires item review:

- Downloads.
- Large personal files.
- Old project artifacts.
- Android emulator images and SDK packages.
- Installed app footprints.

Review-gated categories cannot execute from a broad category approval. The user must mark candidate items as `Remove`, `Move`, `Archive`, or `Keep`; only decided item bytes can enter selected recovery, executor previews, and the ledger. For most review-gated categories, only `Remove` creates executor bytes and `Move`/`Archive` stay manual. `large-user-files` is the scoped exception: `Move` and `Archive` create exact archive executor targets only when the native feature flag, destination, consent, scan fingerprint, and path validators pass.

Installed app footprints are the exception to the selected-recovery rule: marking an app uninstall candidate records manual follow-up only. It does not count as executor recovery, dry-run bytes, or simulated ledger recovery.

Requires typed acknowledgement:

- WSL VHDX compaction.
- Hibernation file removal.

Blocked:

- Docker volumes.
- Browser cookies, sessions, saved logins, and extension state.
- Pagefile tuning.
- Registry cleanup.
- Unknown app data.
- Direct deletion from `C:\Windows`, `Program Files`, or `ProgramData`.
- Automated partition resizing.

When cleanup cannot meet the requested target, the app switches to manual strategy guidance. Installed app review, custom root review, library migration, archive storage, drive upgrades, and partition work stay advisory-only; the product does not automate uninstallers, custom folder deletion, partition writes, registry edits, or bulk personal-file deletion.

Custom root triage is the follow-through for unknown local folders. The scanner can measure user-specified roots read-only, but each finding must be marked Keep, Archive, Move, Inspect, or Escalate. Archive and Move show advisory manual impact only; they do not create executor rows, recovery totals, or real cleanup permission.

Manual strategy guidance has its own checklist. The user can mark evidence such as full backup, archive destination, official uninstall path, app-native library move, save/source protection, and recovery keys. These marks are stored locally for follow-along workflow only; they do not unlock real cleanup or release gates.

User-protected paths are treated as a runtime block even if the matching recipe would normally be selectable.

Admin/system-sensitive routes are also intake-gated. Windows.old, hibernation changes, WSL compaction, and other admin-sensitive routes stay out of suggested and selectable dry-run plans until the user explicitly allows admin/system actions. Allowing them only affects dry-run planning; it does not enable real execution, self-elevation, UAC prompts, or destructive commands.

Task runbook work orders are agent-facing instructions, not new permissions. A selected cache cleanup task can ask for its own approval or enter its own dry-run simulation after grants are issued, but it cannot reuse that power for Downloads, custom roots, browser identity data, partitions, registry keys, or any sibling folder.

The restriction matrix is the refusal surface. Browser identity stores, Docker volumes, pagefile and registry tuning, partition writes, custom roots, admin/system routes, personal/project data, and broad tool-native shell commands each show what the agent may still do and what remains forbidden. Hard-blocked and manual-only rows cannot create executor routes. Named scoped executors, including the fixed Docker build-cache prune route, are tracked separately by the executor layer and only appear when their feature flag is enabled.

The Windows setup assistant is the first-run operational guide. It can recommend `npm run dev`, `npm run native:dev`, `npm run native:build`, and explicit UI exports, but it does not introduce destructive commands. Its forbidden command list includes direct delete, registry, power, format, and partition operations.

Execution is blocked until the preflight passes:

- Scan complete.
- Scanner idle.
- Scan session fingerprint matches the current settings when native evidence is used.
- At least one action selected.
- Approval gates resolved.
- No selected protected paths.
- Selected actions stay within the current Safe, Balanced, or Emergency risk budget.
- Plan lock matches the active scan fingerprint and risk budget.
- Ledger has not already run for the current plan snapshot.
- Executor policy has at least one simulatable dry-run route.
- No selected executor route is policy-blocked.
- Real deletion is still disabled.
- The current plan snapshot has been armed through the final dry-run consent receipt.

Every simulation is tagged with a plan id. If the user changes selected actions, approvals, protected paths, item decisions, scan mode, scan-session fingerprint, goal, or admin/system intake allowance, the old ledger becomes stale and the current plan can be simulated again. The verification panel and exported report show whether the ledger is current, stale, missing, or needs rescan.

Final consent is also plan-lock-specific. A user can arm only the current plan after run readiness passes. The receipt stores the current plan id and plan-lock id. Changing selection, approvals, protected paths, review item decisions, scan mode, scan-session fingerprint, risk budget, or goal clears or stales the receipt and disables simulation again.

The post-run verification panel converts the current ledger into route-level checkpoints. Each checkpoint includes the affected root, expected bytes, route, and evidence required for a read-only rescan comparison. Stale ledgers cannot produce valid checkpoints for the current plan.

The agent questions panel is the workflow control surface. It asks for the next decision only after deriving it from current state: scan first, approve rebuildable caches, allow admin/system routes into dry-run planning when lower-risk cleanup is exhausted, review per-item decisions, arm dry-run consent, simulate the armed plan, capture validation details, or probe the native route branch in non-mutating mode. These actions reuse existing gates and cannot bypass preflight, consent, release gates, or real-execution locks.

The rescan comparison panel is stricter than the checklist. It requires an absolute ledger timestamp and a native scan timestamp newer than that ledger before any affected-root row can be marked as matched. Demo scans, stale ledgers, and scans taken before the current run ledger stay in a waiting state. If native bytes remain where the plan expected removal, the row is marked as a mismatch and cannot count as ledger/rescan parity evidence.

The rollback plan is evaluated before dry-run consent. Disposable and rebuildable routes require rescan proof. Reviewed user items require a visible Recycle Bin, quarantine, or archive restore location. Recycle Bin emptying is marked as permanent-removal. Admin and advanced routes require backup or recovery-state evidence. The local rollback proof ledger treats checkbox-only or legacy evidence as draft until reviewer, evidence path, and route-specific restore/backup/acknowledgement reference are filled. None of these checks unlock real cleanup in the current build.

The write-readiness panel is the final real-execution gate. It combines real executor implementation, runtime write capability, release gate status, post-run rescan parity, rollback proof, privilege boundary, privacy boundary, and current plan consent. It stays locked until the selected route exposes a scoped feature-flagged executor and current evidence passes.

The real executor capsule names the selected first-safe route that could become a write-capable executor. It lists the route implementation boundary, required fixtures, missing validation, code-path status, and blockers. It reports destructive action availability separately from route selection, so disabled and enabled scoped executors are visible without implying broader cleanup authority.

The first-safe executor contract turns that capsule into a concrete request-shape preview for `execute_cleanup_plan`: selected route, plan id, scan fingerprint, action ids, target paths, expected bytes, allowed targets, forbidden targets, target-scope audit, feature flag, and the route-specific native request mode such as `execute-first-safe`. The probe variant keeps `dryRunOnly=true` and `mutationAttempted=false`, so it validates the native route branch without cleanup. Real execution still happens only from the matching executor panel after the route flag, consent, target validation, and proof gates pass.

The first-safe validation gate converts that route contract plus Windows validation evidence into an implementation-planning decision. It shows each route-required check, fixture coverage, unsafe runtime signals, and blockers while keeping `realRunAllowed=false` even when every route check passes.

The first-safe work order is the handoff from validation into implementation. For the selected route it lists build items, acceptance tests, fixture ids, feature flag, rollback/rescan proof, and write-boundary reprobe requirements. A ready work order means an engineer can start the disabled executor slice; it does not mean the app can delete anything.

The temp executor activation gate is the route-level decision after the work order. It explains whether `known-temp-delete` is blocked by missing preflight, disabled `tempCleanupExecutor`, validation blockers, release blockers, or unsafe runtime signals. When the route is not fully enabled and validated, the gate keeps `activationAllowed=false`, `mutationEnabled=false`, and `realRunAllowed=false`.

The temp activation rehearsal exists for the no-real-data demo path. It builds a synthetic rejected probe with the current contract echo, disabled scaffold, zero bytes, and per-action preflight checks. The expected rehearsal status is `rehearsal-ready` with its nested activation gate at `feature-flag-disabled`; this is presentation and workflow proof only, not native validation evidence.

The write boundary probe is separate from write readiness. It may call the native `execute_cleanup_plan` route branch in non-mutating probe mode, but success means rejection, not cleanup: `accepted=false`, all entries rejected with native reject codes, zero reclaimed bytes, and a native echo that matches the current first-safe executor contract. Target-scope reject codes are diagnostic only and do not count as passing rejection evidence. Probe entries are never ledger recovery.

When the selected route maps to a scoped executor, the probe reports its scaffold and feature-flag status without mutating the filesystem. Disabled flags stay rejected; enabled routes still require current plan consent, scan fingerprint evidence, target validators, and post-run proof before execution.

The probe entry preflight checks are the native proof that request shape, target allowlist, mutation lock, feature flag, and validation state are evaluated before any executor could run. The expected current outcome for known temp is preflight passing the shape/target/mutation checks, then blocking on the disabled feature flag and missing validation evidence.

The fixture evidence import accepts the JSON produced by `scripts/inspect-spaceguard-fixtures.ps1`. It can fill the `scanner-fixtures` validation record after the fixture JSON passes schema, count, age, size, destructive-command, reviewer, and artifact checks. For the first real temp proof, run it before cleanup and again with `-AfterCleanupRoute known-temp-delete` after cleanup; that mode expects only the `known-temp-fixture` record to be missing and still requires the other seeded fixtures to remain present. It can also fill `dry-run-target-scope` only when the evidence includes explicit passing dry-run scope cases with allowed and rejected targets. Use **Export scope evidence** to run the native metadata-only scope probe and create the minimal `spaceguard-native-dry-run-scope/v1` JSON consumed by the fixture inspector. Protected-path, rollback, tool-command, native-build, and ledger/rescan evidence still require their own records.

When the read-only scan finds `%TEMP%\spaceguard-fixture`, the app creates a **Seeded temp fixture** action. It uses the same `known-temp-delete` executor route but submits only `%TEMP%\spaceguard-fixture` in the first-safe request preview. This gives the Windows VM a real delete/rescan loop before a user selects broader `%TEMP%` or `C:\Windows\Temp` cleanup.

Dry-run records are also saved to local browser storage as an append-only run history. A saved record can block a duplicate simulation for the same plan after reload, but it cannot unlock real execution. The history export is audit evidence only; real cleanup still requires native Windows validation and a post-run rescan.

Broad deletion remains disabled. The executor layer classifies selected actions as dry-run routes, scoped feature-flagged executors, future safe-executor candidates, gated routes, or blocked routes. Temp files, reviewed Downloads files, reviewed large-file archives, Recycle Bin emptying, reviewed `node_modules`, Gradle cache roots, user `.cache`, Android cache roots, pip cache, Docker build cache, npm `_cacache`, pnpm store, and browser cache roots are the only write-capable families, and only when their Windows runtime flags are enabled.

The executor manifest is the real-data implementation map. It covers all route families, not just selected actions:

- First-safe lanes: known temp roots, Recycle Bin boundary, and browser cache only.
- Second-safe lanes: bounded rebuildable caches, tool-native prune commands, and launcher caches.
- Later/manual lanes: Windows cleanup API, reviewed item routes, WSL compaction, hibernation, and partition strategy.
- Never lanes: Docker volumes, browser identity stores, pagefile tuning, and other policy-blocked routes.

Each manifest route lists required Windows validation checks, disposable fixtures, preconditions, proof, rollback posture, and whether real execution is still locked.

The tool command inventory shows fixed command shapes so validation work is concrete. The current app does not run arbitrary shell commands or app uninstallers. Most real executors use bounded filesystem APIs; reviewed Downloads and Recycle Bin routes use Windows Shell APIs (`SHFileOperationW`, `SHQueryRecycleBinW`, `SHEmptyRecycleBinW`) inside route validators. The only external-command write route is Docker build-cache cleanup: when `SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS=true`, the native executor may run the fixed `docker builder prune --force` command after the route, consent, scan fingerprint, and target validators pass.

Broad cleanup remains locked. Scoped real cleanup is available only for named executor families when their runtime feature flag is enabled and every per-run precondition passes:

- Real executor feature flag is enabled.
- Native Windows scan evidence is available.
- Current plan id, scan fingerprint, and consent receipt match.
- Native target validators accept the exact route and target paths.
- Runtime privilege evidence is captured for admin-sensitive routes.
- Scanner, guardrail, executor, verification, rollback, and signing checks pass.
- Disposable Windows VM scenarios pass for standard user, admin low-disk, browser-heavy, developer-toolchain, and review-gated data profiles.
- At least one selected executor route is eligible.

Use **Export validation pack** from the app before enabling real data execution work. The pack is a markdown file with embedded JSON for:

- Required Windows validation checks.
- Disposable VM scenario checklists.
- Fixture roots to seed on test machines.
- Read-only fixture evidence generated from the seeded Windows VM files.
- Dry-run target-scope fixture evidence showing rejected targets return zero candidate samples.
- Native/runtime capability evidence.
- Selected executor routes under review.
- Full executor manifest with route status and next steps.
- Local dry-run history summary.
- Operator/reviewer signoff fields and per-check artifact paths.

The validation evidence panel lets an operator record completed checks locally after a Windows VM run. A check only counts when it has `status=passed`, a reviewer, and an evidence path or artifact id. Legacy checkbox-only records stay visible as detail-needed records. Evidence records are persisted in browser storage and exported in the validation pack, but they do not unlock real execution unless native Windows evidence, runtime feature flags, eligible routes, and every release gate also pass.

The privacy boundary is local-first by default. Native scans can include local paths, filenames, and read-only Windows uninstall metadata in reports only when the user exports them. The current build has no cloud upload, telemetry event sender, registry writes, browser identity collection, or automatic report sync.

The public beta readiness panel is separate from the real-executor release gate. A web demo can be publishable when writes are locked and privacy is local-only. A native read-only beta additionally requires native scan evidence, public release/runbook docs, signing or SmartScreen/distribution evidence, and install/uninstall/support readiness. None of that means real cleanup is enabled.

The support bundle is the default artifact for support triage. It includes runtime mode, scan coverage, route status, release blockers, and warnings, but it intentionally excludes local paths and filenames. The full dry-run report remains a separate user-started export for cases where path-level diagnosis is required.

The workflow handoff is the default resume artifact. It includes the active agent question, next resume actions, audit state, selected workflow statuses, and the real-cleanup lock without local paths or filenames. It is not support evidence and does not grant cleanup authority.

The beta handoff manifest is the artifact index for public or native-beta sharing. It marks workflow handoff and support bundle as redacted public/support-safe rows, while validation packs, release packets, beta evidence ledgers, and full dry-run reports stay internal or path-level until explicitly approved.

The release review packet is the default artifact for deciding whether the product can move from demo/read-only validation to the next review stage. It can be ready only when every review row passes and broad cleanup remains locked. Named scoped executor routes are listed separately. Unscoped runtime write capability, broad destructive command signals, accepted write-boundary results, contract mismatches, or non-zero write-boundary byte counts change the packet to `unsafe-stop`.

## Native App Direction

The production shell should become a signed Windows desktop app with:

- Tauri frontend and Rust scanner service.
- Dry-run first execution model.
- Per-recipe executors that prefer official tool commands.
- Append-only local cleanup ledger.
- No cloud upload by default.

The current native slice is intentionally scoped. The next product milestone is Windows validation evidence and post-run rescan proof for temp, reviewed Downloads, reviewed large-file archive, Recycle Bin, reviewed dependency, Gradle cache, user `.cache`, Android cache, shader cache, pip cache, Docker build-cache, npm cache, pnpm store, and browser cache executors, while automated app uninstall, partition work, Docker volumes, and broader tool-native prune commands remain future work or manual-only.

The native runtime also reports elevation state. This is evidence only: the app does not self-elevate, request UAC, or turn admin-sensitive routes into real executors.

For real-data setup today:

1. Complete **Demo rehearsal runbook** in browser demo mode and export the dry-run report as no-real-data proof.
2. Run `npm run native:dev` on a Windows 11 machine with the prerequisites above.
3. Use **Run real scan** to collect read-only known-root measurements and C: volume totals.
4. Review protected paths, item review, executor policy, release gate, write readiness, and real executor capsule.
5. Arm consent and run the dry-run or scoped executor route, then use **Run post-run rescan** in verification to collect after-ledger read-only proof without clearing the ledger.
6. Use **Probe write boundary** only to capture rejection evidence from the native non-mutating route probe.
7. Export the dry-run report and validation pack.
8. Validate fixtures in disposable Windows VMs before implementing any write-capable executor.
