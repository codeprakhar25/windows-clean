# Windows Real-Data Setup

This guide is for moving SpaceGuard from browser demo data to real local measurements and scoped feature-flagged cleanup executors.

## Safety Boundary

Default native mode is read-only:

- It measures known local roots and C: volume totals.
- It can produce native dry-run ledger entries.
- It does not delete files, edit registry keys, resize partitions, run cleanup shell commands, or self-elevate unless a named scoped executor flag is explicitly enabled. Installed-app discovery may read Windows uninstall metadata locally, but it never runs uninstall strings or changes registry values.
- Review-gated findings still require per-item decisions.

Use a disposable Windows 11 VM for fixture validation. Use your real machine only after a read-only smoke test and only for a named scoped executor whose consequence you accept.

## Prerequisites

Install these on Windows:

- Node.js and npm.
- Rust with the MSVC toolchain.
- Microsoft C++ Build Tools with "Desktop development with C++".
- Microsoft Edge WebView2 Runtime.

Then install dependencies:

```powershell
npm install
npm test
npm run demo:rehearsal
npm run native:rehearsal
npm run build
```

Optional OpenAI advisor:

```powershell
Copy-Item .env.example .env
# edit .env and set OPENAI_API_KEY
# optional: set OPENAI_MODEL=gpt-5.2 and OPENAI_REASONING_EFFORT=low
npm run setup:doctor
npm run proof:first-route
# fastest full private V1 Windows proof:
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

`npm run setup:doctor` is read-only. It checks `.env`, OpenAI key presence, model/reasoning defaults, scoped executor flags, and the first-route completion proof without calling OpenAI, scanning folders, or running cleanup. Its `status` is `readonly-ready`, `first-route-proof-required`, `one-route-ready`, or `multi-flag-blocked`; write-mode validation is safe to launch only when exactly one scoped executor flag is enabled and non-temp real-data routes have an accepted `SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK`.

The `realWorkflow` field in the doctor JSON is the compact operator path for the selected route: fixture OpenAI smoke, live OpenAI smoke, route setup, route validation, native scan, consent, selected executor, post-run rescan, proof export, Selected route proof import, and only then next-route consideration.

When exactly one scoped executor flag is enabled, `setup:doctor` maps that flag to the matching route alias and prints route-specific OpenAI smoke, `setup:route`, and `validate:route` commands. For example, `SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR=1` prints commands for `--route pnpm-store`, not the npm sample route.

`npm run openai:smoke:fixture -- --route npm-cache` validates the local fixture task queue and recommendation broker without an API key or network call. Pass another route alias, for example `-- --route pnpm-store`, to validate that route's broker path.

`npm run openai:smoke -- --route npm-cache` validates the OpenAI key, strict advice schema, deterministic agent task queue, and recommendation broker against fixture data only. It exits non-zero unless OpenAI returns the required broker-ready recommendation for the selected route fixture. It does not scan local folders, run cleanup, or use real disk findings.

In `npm run start`, the OpenAI button uses Vite's same-origin `/api/openai-agent/advice` proxy, so `OPENAI_API_KEY` stays in `.env` on the dev server. In `npm run native:dev`, the desktop shell prefers the Rust `openai_agent_advice` command and reads the same `.env` key. Avoid `VITE_OPENAI_API_KEY` for normal testing because it exposes the key to the renderer.

`npm run setup:route -- --route npm-cache` emits a read-only setup packet for the selected real cleanup route. It shows the exact scoped executor flag, native request mode, app panel id, conflicting enabled flags, route-specific OpenAI smoke commands, and next commands before you launch the desktop shell.

For every route after the seeded temp fixture, `setup:route` stays at `first-route-proof-required` until `SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK` points to an accepted `spaceguard-first-route-completion-check/v1` JSON with positive reclaimed bytes for `known-temp-delete`.

`npm run validate:route -- --route npm-cache` emits a read-only Windows validation packet for the selected real cleanup route. It records the pre-run checklist, one-flag requirement, forbidden actions, evidence artifacts, native volume proof expectation, selected-route proof packet export/import, and post-run rescan proof checklist. It does not scan folders, call OpenAI, or execute cleanup.

`npm run proof:first-route` emits a read-only first-route proof packet for the seeded temp fixture. Use it on a disposable Windows VM before the first real cleanup proof; it gives the fixture seed command, before/after fixture inspection commands, the one temp executor flag, route-contract coverage, app steps, forbidden broad-temp actions, and the final positive recovered-byte workflow proof acceptance rule.

`npm run proof:first-route:windows` runs the first-route operator preflight on Windows. It creates an evidence folder, loads `.env`, forces a one-route environment with only `SPACEGUARD_ENABLE_TEMP_EXECUTOR=1`, captures the first-route packet, seeds and inspects fixtures, runs setup doctor, fixture OpenAI smoke, live OpenAI smoke when `OPENAI_API_KEY` is configured, route setup, and route validation, then launches the Tauri app. It writes `operator-preflight.json`, `operator-preflight-check.json`, and `commands.ndjson` before launch. It does not clean anything outside the desktop workflow; the actual fixture deletion still requires in-app scan, target selection, consent, and the **Real temp cleanup** button. After the app exits, the runner writes `native-dev-exit.json`; a nonzero desktop exit stops proof finalization as `native-dev-failed`. A clean app exit continues into after-cleanup fixture inspection, workflow proof validation, and the first-route completion verifier. Use `-SkipPostAppValidation` only for preflight/dev sessions where the app will not export proof yet.

When the completion verifier accepts that evidence, keep the generated first-route completion check JSON and set `SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK` to that path before enabling `SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR`, `SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR`, or another non-temp route flag.

After first-route proof is accepted, `npm run proof:route:windows -- -Route npm-cache` runs the selected-route operator preflight on Windows. It loads `.env`, requires `SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK` to point at an accepted `spaceguard-first-route-completion-check/v1` file, resolves route identity through `setup:route` into `selected-route-setup.json`, forces all scoped executor flags off except the selected route flag, runs setup doctor, route-specific OpenAI fixture smoke, live OpenAI smoke when configured, route setup, and route validation, then launches the Tauri app. It writes `operator-preflight.json`, validates it into `operator-preflight-check.json`, and writes `operator-app-handoff.md` plus `commands.ndjson` before launch. It does not clean anything outside the desktop workflow; the actual selected-route cleanup still requires in-app scan, target selection, consent, selected executor click, native volume proof, post-run rescan, selected-route proof packet export, selected-route proof import, and `spaceguard-real-workflow-proof.md` export. After the app exits cleanly, the runner validates the workflow proof and writes `selected-route-completion-check.json`; that completion artifact is the selected-route handoff for starting the next cleanup route.

For the fastest private V1 proof on a prepared Windows host, run:

```powershell
npm run demo:private-v1-windows -- -SelectedRoute npm-cache
```

This coordinator first imports `.env` and fails with `private-v1-openai-key-required` before any proof work starts if `OPENAI_API_KEY` is unavailable. It then validates the selected route through `setup:route` and writes `selected-route-setup.json`, runs the host preflight, captures copied native bundle artifact evidence after `npm run native:build` with SHA-256 hashes, launches the seeded first-route proof, verifies the accepted `first-route-completion-check.json`, sets `SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK` for the current process, archives the first-route root proof exports into evidence, then launches the selected real-data route proof. It rejects `-SkipLiveOpenAI` because private V1 requires live OpenAI smoke from `.env` `OPENAI_API_KEY`; use lower-level proof runners for fixture-only rehearsals. It writes `private-v1-proof.json` only after route setup is resolved and both route completions are accepted and summarized with reclaimed bytes, ledger bytes, rescan expected bytes, and rescan remaining bytes. It does not add a new cleanup authority path; cleanup remains inside the desktop app's scoped executor, consent, proof export, and completion verifier workflow. Replace the selected route when validating another scoped executor, for example `npm run demo:private-v1-windows -- -SelectedRoute gradle-cache`.

Use `-SkipPreflight` only to reuse an already-passed `private-demo-preflight/private-demo-preflight.json` inside the same V1 evidence root. The coordinator validates that artifact's schema, passed status, selected route, and copied native bundle artifacts before it starts the first-route proof.

The coordinator also writes `private-v1-proof-check.json` by running:

```powershell
npm run validate:private-v1-proof -- --file evidence/private-v1-proof-npm-cache-YYYYMMDD-HHMMSS/private-v1-proof.json
```

That verifier checks the final V1 proof schema, command ledger, selected-route setup artifact, Windows preflight artifact, required child command stderr artifacts, child OpenAI smoke artifacts with `validation=broker-ready`, first-route completion artifact, selected-route completion artifact, accepted status, positive reclaimed bytes, child completion route/rescan parity counts, and the absence of direct cleanup command authority in top-level and child command ledgers.

## First npm real-data proof checklist

Use this exact fast path after the seeded first-route proof is accepted and `SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK` points at the accepted completion check JSON:

```powershell
$env:SPACEGUARD_ROUTE_SETUP_IGNORE_DOTENV="1"
$env:SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR="1"
npm run proof:route:windows -- -Route npm-cache
```

The selected-route runner still owns the final process environment: it forces every other scoped executor flag off before launching the app. In the app, run the native scan, select only the scanned npm `_cacache` target, arm consent, optionally use OpenAI cleanup agent only for ranking and brokered follow-through, click the npm scoped executor, capture native volume proof, run the post-run rescan, export `spaceguard-selected-route-proof-packet.md`, complete Selected route proof import, re-export the selected-route proof packet, and export `spaceguard-real-workflow-proof.md`. Do not close the app until native volume proof, selected-route proof packet export, selected-route proof import, and workflow proof export are complete.

If selected-route proof export/import is corrected after the desktop session closes, resume only selected-route post-app finalization against the existing evidence folder:

```powershell
npm run proof:route:windows:finalize -- -Route npm-cache -EvidenceRoot .\evidence\route-proof-npm-cache-YYYYMMDD-HHMMSS
```

To re-check a captured selected-route preflight bundle manually:

```powershell
npm run validate:route-preflight -- --file .\evidence\route-proof-npm-cache-YYYYMMDD-HHMMSS\operator-preflight.json
```

That verifier requires the captured `selected-route-setup.json`, the `resolve-selected-route` command record, the ready `setup-route.json`, and the selected-route validation packet to agree on the same canonical route and scoped executor flag.

If proof export/import is corrected after the desktop session closes, resume only post-app finalization against the existing evidence folder:

```powershell
npm run proof:first-route:windows:finalize -- -EvidenceRoot .\evidence\first-route-proof-YYYYMMDD-HHMMSS
```

The preflight bundle also writes an app-close proof contract. Before closing the desktop app, complete the post-run rescan, export the selected-route proof packet, import that packet with reviewer/artifact detail, and export `spaceguard-real-workflow-proof.md` to the repo root. The runner and completion verifier keep the next route blocked until `validate:first-route-completion` accepts that proof with positive reclaimed bytes.

To re-check a captured preflight bundle manually:

```powershell
npm run validate:first-route-preflight -- --file .\evidence\first-route-proof-YYYYMMDD-HHMMSS\operator-preflight.json
```

After the app exports `spaceguard-real-workflow-proof.md`, validate the final route handoff:

```powershell
npm run validate:workflow-proof -- --file .\spaceguard-real-workflow-proof.md
```

The verifier exits successfully only for `spaceguard-real-workflow-proof/v1` packets with `workflow-proven`, `readyForNextRoute=true`, completed selected-route proof import, retained execution-ledger plus matched-rescan counts, and the app-close proof contract exported by the desktop app.

For a selected route after `known-temp-delete`, validate the whole route completion chain:

```powershell
npm run validate:route-completion -- --preflight .\evidence\route-proof-npm-cache-YYYYMMDD-HHMMSS\operator-preflight.json --native-exit .\evidence\route-proof-npm-cache-YYYYMMDD-HHMMSS\native-dev-exit.json --workflow-proof .\spaceguard-real-workflow-proof.md
```

This completion verifier reads the selected-route preflight bundle, `commands.ndjson`, native app exit evidence, selected-route proof packet, and workflow proof. It requires successful records for `validate-selected-route-preflight`, `native-dev-launch`, `native-dev-exit`, `finalize-after-app`, and `workflow-proof-check`, verifies that ledger rows, rescan rows, and workflow proof all bind to the same route and reclaimed byte count, then reports whether the next route may start.

For the seeded first route, validate the whole first-delete chain after `fixture-after-cleanup.json` exists:

```powershell
npm run validate:first-route-completion -- --preflight .\evidence\first-route-proof-YYYYMMDD-HHMMSS\operator-preflight.json --after-fixture .\evidence\first-route-proof-YYYYMMDD-HHMMSS\fixture-after-cleanup.json --native-exit .\evidence\first-route-proof-YYYYMMDD-HHMMSS\native-dev-exit.json --workflow-proof .\spaceguard-real-workflow-proof.md
```

This completion verifier also reads the preflight bundle's `commands.ndjson` and requires successful post-app records for `native-dev-launch`, `native-dev-exit`, `finalize-after-app`, `inspect-fixtures-after`, and `workflow-proof-check`.

Optional first-safe temp executor:

```powershell
# alternatively set this in .env
$env:SPACEGUARD_ENABLE_TEMP_EXECUTOR="1"
npm run native:dev
```

For the first real cleanup proof, seed the disposable fixture and select **Seeded temp fixture** after the native scan. That action targets only `%TEMP%\spaceguard-fixture` through `known-temp-delete`; when it appears, the broad **Windows temporary files** action is not auto-selected.

Optional reviewed project dependency executor:

```powershell
$env:SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR="1"
npm run native:dev
```

Optional reviewed Downloads executor:

```powershell
$env:SPACEGUARD_ENABLE_DOWNLOADS_EXECUTOR="1"
npm run native:dev
```

Optional reviewed large-file archive executor:

```powershell
$env:SPACEGUARD_ENABLE_LARGE_FILE_ARCHIVE_EXECUTOR="1"
npm run native:dev
```

Optional Gradle cache executor:

```powershell
$env:SPACEGUARD_ENABLE_GRADLE_CACHE_EXECUTOR="1"
npm run native:dev
```

Optional user `.cache` executor:

```powershell
$env:SPACEGUARD_ENABLE_USER_CACHE_EXECUTOR="1"
npm run native:dev
```

Optional Android cache executor:

```powershell
$env:SPACEGUARD_ENABLE_ANDROID_CACHE_EXECUTOR="1"
npm run native:dev
```

Optional shader cache executor:

```powershell
$env:SPACEGUARD_ENABLE_SHADER_CACHE_EXECUTOR="1"
npm run native:dev
```

Optional pip cache executor:

```powershell
$env:SPACEGUARD_ENABLE_PIP_CACHE_EXECUTOR="1"
npm run native:dev
```

Optional Docker build-cache executor:

```powershell
$env:SPACEGUARD_ENABLE_TOOL_NATIVE_PRUNE_EXECUTORS="1"
npm run native:dev
```

Optional npm cache executor:

```powershell
$env:SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR="1"
npm run native:dev
```

Optional pnpm store executor:

```powershell
$env:SPACEGUARD_ENABLE_PNPM_STORE_EXECUTOR="1"
npm run native:dev
```

Optional Recycle Bin executor:

```powershell
$env:SPACEGUARD_ENABLE_RECYCLE_BIN_EXECUTOR="1"
npm run native:dev
```

Optional browser cache executor:

```powershell
$env:SPACEGUARD_ENABLE_BROWSER_CACHE_EXECUTOR="1"
npm run native:dev
```

Those flags can be set in `.env` or the PowerShell process before `npm run native:dev`. Those flags enable only their named routes: `known-temp-delete`, reviewed Downloads installer/archive moves through Recycle Bin semantics, reviewed large-file archive to an explicit other-drive destination, reviewed `node_modules` cleanup, current-user Gradle cache cleanup, current-user `.cache` cleanup, scanned Android cache cleanup, scanned current-user shader cache cleanup, current-user pip cache cleanup, Docker build-cache prune through `docker builder prune --force`, current-user npm `_cacache` cleanup, current-user pnpm store cleanup, Shell Recycle Bin emptying for the selected drive, and scanned browser cache roots. They do not enable Docker volume cleanup, broad `docker system prune`, Docker image prune, Docker data-root deletion, registry edits, partition changes, hibernation/pagefile changes, browser identity-store deletion, Android AVD/SDK deletion, game install or save-data deletion, Python install or virtualenv deletion, project source deletion, arbitrary Downloads folder deletion, arbitrary personal-folder deletion, or arbitrary project-folder deletion.

For any scoped route after `known-temp-delete`, the same `.env` must also set `SPACEGUARD_FIRST_ROUTE_COMPLETION_CHECK` to the accepted first-route completion check JSON. Without that file, setup doctor, route setup, and route validation keep the route blocked even when exactly one executor flag is enabled.

## Read-Only Real Scan

Start the desktop shell:

```powershell
npm run native:dev
```

In the app:

1. Check **Windows setup assistant**. Browser demo is enough for rehearsal; desktop shell plus current read-only scan evidence is required for real local data.
2. Complete **Demo rehearsal runbook** in browser demo mode first. It should show no native data required, no destructive commands, broad cleanup locked, and zero scoped real-run routes before you export the dry-run report.
3. Review **Temp activation rehearsal** for the no-real-data path. It should show demo-only synthetic evidence, activation gate `feature-flag-disabled`, zero bytes, and mutation locked.
4. Set **Real scan settings** for target drive, project artifact inclusion, traversal depth, per-root entry cap, and optional custom read-only roots. Default project discovery searches common current-user folders such as `Code`, `dev`, `Projects`, `repos`, and `workspace`; add custom roots for projects outside those folders.
5. Check **Native scan request guard**. Fix malformed drive scope, unapproved traversal caps, protected-path overlap, or broad system roots before the scan button can run.
6. Click **Run real scan**.
7. Check **Real data readiness** for native availability, write capability, destructive command state, and target-drive volume evidence.
8. Check **Drive inventory** for top-level target-drive buckets. Inventory rows are read-only context only; they cannot create executor routes. Use narrower custom roots or item review for unknown/user-data buckets.
9. Check **Storage pressure diagnosis** to answer why the drive is full, which causes dominate, and which safe branch comes next. Diagnosis is advisory and cannot grant cleanup authority.
10. Check **Native evidence quality**. It should show planning-grade or partial read-only evidence, current scan freshness, measured coverage, local-only privacy, and a clear separation between read-only planning evidence and any named feature-flagged executor route.
11. Check **Scan session** and confirm the captured fingerprint is current. If target drive, custom roots, traversal caps, project-artifact setting, or protected paths changed, rerun the native scan before planning.
12. Review **Intake constraints**. Leave admin/system actions off unless this validation run intentionally includes Windows.old, hibernation, WSL compaction, or another admin-sensitive dry-run route.
13. Check **Risk budget** to confirm selected routes stay within Safe, Balanced, or Emergency mode before dry-run consent.
14. Check **Plan lock** to confirm the lock binds the current plan id, scan fingerprint, selected rows, risk budget, and consent state before launch.
15. Check **Task powers** to confirm selected routes activate only scoped powers and that admin, advanced, manual, or restricted powers stay locked or advisory as expected.
16. Check **Task grants** after arming dry-run consent. Every issued grant must be `dry-run-only`, tied to the current plan id and scan fingerprint, and must refuse issuance if runtime write capability appears.
17. Check **Power lease audit** to confirm each issued grant still matches the current plan id, scan fingerprint, dry-run consent, broker request, and runtime write lock.
18. Check **Safety interlock** to confirm unsafe signals are zero, dry-run is either explicitly held or dry-run-interlocked, and real execution remains locked.
19. Check **Dry-run launch guard** to confirm simulation is blocked until run readiness, current consent, current plan lock, and safety interlock all pass.
20. Check **Operating checklist** to confirm the safe next action, active user decision, ledger state, and zero real-run rows are visible in one place.
21. Check **User decision receipt** to confirm selected tasks, approvals, item decisions, protected paths, admin intake, consent, active question, and real-run lock are recorded without granting cleanup authority.
22. Check **Task runbook** to confirm each selected cleanup target has its own next question, allowed operations, forbidden operations, evidence needs, and no cross-task authority.
23. Check **Restriction matrix** to confirm browser identity, Docker volumes, pagefile or registry tuning, partition writes, custom roots, app uninstall review, admin/system work, personal/project data, and tool-native commands stay in the correct refusal or gated lane. Read-only uninstall metadata can inform app review; it is not uninstall authority.
24. Add protected paths before planning any review-heavy route.
25. Use **Custom root triage** for custom read-only findings. Mark each unknown folder Keep, Archive, Move, Inspect, or Escalate; these dispositions stay manual and cannot create executor routes.
26. Use **Item review** for Downloads, large personal files, project artifacts, Android Studio findings, and installed app footprints. App footprint decisions are manual uninstall follow-up only; folder age is not usage proof. Structured app signals such as usage proof, UserAssist launch evidence, registry match, publisher, install date, uninstall entry, measured size, and official manual action should be visible before marking an app for uninstall follow-up. The app uninstall review dossier must show the same usage-proof boundary and manual-only status.
27. Use **App uninstall work order** after selecting recognized unused app candidates. Export the work order, uninstall manually through Windows Settings or the vendor uninstaller, never run uninstall strings or delete Program Files folders, then run a native rescan to verify the footprint changed.
28. Use **WSL compaction work order** only after native scan finds `ext4.vhdx` targets and the user types `COMPACT WSL`. Export the work order, back up or export the distro, shut down and compact WSL manually outside SpaceGuard, verify the distro boots, then run a native rescan. SpaceGuard must not run `wsl.exe`, PowerShell, `Optimize-VHD`, partition tools, or delete VHDX files.
29. Use **Real cleanup command flow** as the operator spine. Pick one scoped route in the route selector, then walk through native scan, consent, route checks, OpenAI recommendation follow-through, execution, and post-run rescan proof without creating new authority.
30. Use **OpenAI cleanup agent** for advisory ranking and explanation only. In the desktop shell, the panel and command-flow card call the native `openai_agent_advice` command; Rust reads `OPENAI_API_KEY` from `.env` or the process environment, sends the bounded scan/plan context plus reviewed project dependency targets and scanned Gradle/user `.cache`/Android/shader/pip/Docker build-cache/npm/browser cache targets to OpenAI, and defaults to `gpt-5.2` unless `OPENAI_MODEL` is set. In Vite dev, the panel uses `/api/openai-agent/advice` so the same `.env` key stays server-side. The context includes an **Agent task queue** made from deterministic scan-derived executor, review, and manual-only rows; review rows preserve evidence such as Expo framework signals, app usage-proof state, uninstall-entry presence, unused-review tier, and manual-only guardrails. OpenAI can rank those rows, but brokerable recommendations must copy the row's `actionType`, `targetId`, and `route`. The response is strict JSON for ranked actions, blockers, questions, and warnings; successful advice calls create a compact local run record with plan id, provider metadata, recommendations, and redacted context counts. Executor recommendations may show user-clickable buttons, but those buttons still use the app's existing consent, scan, feature-flag, action-route-match, first-route proof, proof-state, and target-validation checks. A clicked brokered recommendation creates **Latest agent handoff** evidence and, if a native executor records a ledger, the ledger entry is annotated with `OpenAI handoff`. The model cannot scan folders, approve gates, or run cleanup.
31. Use **Executor smoke-run packet** to confirm the selected scoped route, feature flag, request mode, target evidence, current scan fingerprint, current consent receipt, proof clearance, and export checklist before a Windows smoke run. If several selected routes are ready, the packet's active route is the only route that can run now; queued ready routes remain blocked even from their own executor panels until selected as active after post-run proof.
32. Use **Agent questions**, **Manual strategy checklist**, **Executor policy**, **Tool command inventory**, **Rollback plan**, **Public beta readiness**, **Release gate**, **Write readiness**, **Real executor capsule**, **First-safe executor contract**, **First-safe validation gate**, **First-safe work order**, **Temp executor activation**, **Release review packet**, **Validation evidence**, and **Product completion audit** to confirm only named feature-flagged scoped executors can run and every other route remains locked.
33. Paste the `spaceguard-fixture-evidence/v1` JSON into **Fixture evidence import** with reviewer and artifact id. This can fill only the scanner-fixture validation record.
34. Record rollback proof in **Rollback plan** only after restore, backup, or permanent-removal acknowledgement evidence exists; fill reviewer, evidence path or artifact id, and the route-specific reference.
35. Mark completed validation checks in **Validation evidence** only after the matching Windows VM evidence exists, then fill reviewer and evidence path or artifact id.
36. If resuming from an exported `spaceguard-validation-pack/v1` file, paste the JSON or markdown export into **Validation pack import**. Imported rows still need reviewer and artifact detail before they can pass release gates.
37. After a scoped native route finishes and the post-run rescan matches, export **Selected route proof packet** and paste the `spaceguard-selected-route-proof-packet/v1` markdown or JSON into **Selected route proof import**. Fill reviewer and artifact path; the import maps only to `ledger-rescan-parity` and rejects demo or dry-run proof.
38. Use **Probe write boundary** only when the desktop runtime exposes `execute_cleanup_plan`; rejection-mode evidence must show rejection, zero bytes, matching first-safe contract echo, and no mutation.
39. Use **Real temp cleanup** first with **Seeded temp fixture** selected. The first-safe request should show one target, `%TEMP%\spaceguard-fixture`; broad `%TEMP%` and `C:\Windows\Temp` cleanup should remain manually selectable but not part of the fixture proof. Accepted native writes should show a `measured` volume proof with before/after drive free bytes, then you still run a fresh native scan to verify route-level free space.
40. Use **Reviewed Downloads cleanup** only after native scan item review shows exact old installer/archive file targets in the current user's Downloads folder and the user has marked those items **Remove**. The native executor moves accepted files through Recycle Bin semantics; it rejects directories, recent files, and arbitrary personal folders.
41. Use **Reviewed large-file archive** only after native scan item review shows exact old 1GB+ personal file targets, the user has marked those items **Move** or **Archive**, and an existing archive destination on another drive is entered. The native executor copies into a plan-specific `SpaceGuard Archive` folder, verifies copied size, then removes the source file; it rejects folders, recent/small files, system/app destinations, and same-drive destinations.
42. Use **Reviewed project dependencies** only after native scan item review shows exact `node_modules` targets, structured package metadata, package manager or lockfile evidence, framework/script hints, and the user has marked those items **Remove**. Expo and React Native hints are advisory context; they do not auto-select a target.
43. Record native beta distribution evidence with reviewer and artifact paths. Use [NATIVE_BETA_DISTRIBUTION.md](./NATIVE_BETA_DISTRIBUTION.md) for install/uninstall, support, signing, and public-claim evidence.
44. Export the local evidence backup before clearing browser storage or switching profiles. Importing this backup restores evidence ledgers and run history only; it does not restore scan results, selected actions, consent, runtime capability, or cleanup authority.
45. Export the workflow handoff for resume guidance, the redacted support bundle for diagnostics, and the beta handoff manifest to label which artifacts are public-safe, internal-only, or path-level. Export the release review packet, dry-run report, validation pack, and native beta evidence ledger when review or path-level evidence is needed.

## Disposable Fixture Run

The fixture script creates small named files under known roots so the native scanner has safe evidence to find in a VM. It has no cleanup or delete command.

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\seed-spaceguard-fixtures.ps1
```

Optional large-file discovery fixture:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\seed-spaceguard-fixtures.ps1 -LargeCandidateMB 1280
```

The optional large candidate can consume real disk space depending on the filesystem. Use it only in a disposable VM or set a smaller value for smoke testing that does not exercise the 1 GiB threshold.

The fastest first-proof path is:

```powershell
npm run proof:first-route:windows
```

For manual seeding:

1. Run `npm run native:dev`.
2. Click **Run real scan**.
3. Confirm the action list contains **Seeded temp fixture** and that **Windows temporary files** is not selected by default for this fixture run.
4. Inspect the seeded fixture metadata before cleanup:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\inspect-spaceguard-fixtures.ps1 -EvidencePath .\evidence\fixture-before-cleanup.json
```

5. With `SPACEGUARD_ENABLE_TEMP_EXECUTOR=1`, select only **Seeded temp fixture**, arm consent, use **Real cleanup command flow** for `known-temp-delete`, and run **Real temp cleanup**.
6. Run a fresh native scan and confirm `%TEMP%\spaceguard-fixture` no longer contributes bytes before trying any broader temp cleanup.
7. Inspect the after-cleanup fixture state:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\inspect-spaceguard-fixtures.ps1 -AfterCleanupRoute known-temp-delete -EvidencePath .\evidence\fixture-after-cleanup.json
```

After the desktop runtime exposes native dry-run support, use **Export scope evidence** in the Executor policy panel. The app runs a metadata-only scope probe with one allowed temp target and rejected Downloads/browser-identity targets, then exports the result for fixture inspection:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\inspect-spaceguard-fixtures.ps1 -DryRunScopeEvidencePath .\evidence\native-dry-run-scope.json
```

The exported file uses `spaceguard-native-dry-run-scope/v1`. It contains `entries` with `id`, `route`, `targetPath`, `targetScopeStatus`, `rejectCode`, and `candidateCount`, while excluding raw candidate filename samples. The fixture manifest expects at least one allowed first-safe target and at least one rejected target with `candidateCount: 0`.

8. Confirm fixture-backed findings appear as measured or limited.
9. Confirm large personal files appear in item review only, not as bulk cleanup.
10. Attach both fixture evidence JSON paths to the validation pack notes.
11. Import the fixture evidence JSON in the app to create the scanner-fixture validation record. If `dryRunScopeCheck.passed=true`, the same import can also create the dry-run target-scope validation record.
12. Export the validation pack.
13. Restore the VM snapshot before the next validation pass.

## Evidence To Capture

For each Windows validation run, capture:

- `npm test` output.
- `npm run build` output.
- `npm run native:dev` smoke result.
- Runtime capability panel state.
- Real scan settings used for the native scan, including target drive.
- Scan session status, current fingerprint, captured fingerprint, and any changed settings.
- Intake constraints, including admin/system action allowance.
- Risk budget state, including mode, ceiling, over-budget rows, blocked rows, and real-run row count.
- Plan lock state, including lock id, plan id, scan fingerprint, risk status, consent lock id, preflight blockers, launch blockers, and real-run row count.
- Task powers state, including active, waiting, locked, advisory, blocked, and real-run-disabled rows.
- First-safe executor contract status, request mode, selected route, target-scope audit, allowed targets, forbidden targets, and write-disabled state.
- Windows validation packet post-run proof checklist, including execution ledger, native volume proof, selected-route proof packet, selected route proof import, post-run rescan parity, and route flag reset.
- Power lease audit state, including current, waiting, stale, blocked, unsafe, plan, scan, consent, broker, and runtime-lock checks.
- Safety interlock state, including unsafe rows, hold rows, dry-run blockers, dry-run allowance, real-run lock, and destructive-command visibility.
- Dry-run launch guard state, including readiness, current consent, safety interlock pass/fail, real-run lock, and blocked checks.
- Operating checklist state, including safe action, actionable row count, dry-run allowance, real-run lock, and unsafe-row count.
- User decision receipt state, including approval rows, item-review decision counts, protected-path count, consent row, active question, unsafe rows, and real-run row count.
- Custom root discovery rows, if any; these are manual-review evidence and not executor routes.
- Native scan volume totals.
- Drive inventory rows, including top-level bucket status, bytes, classification, and confirmation that executor routes remain zero.
- Storage pressure diagnosis status, ranked causes, current plan gap, and confirmation that diagnosis has zero executor and real-run rows.
- Native evidence quality status, planning-ready flag, measured coverage, missing evidence rows, mutation lock, and confirmation that executor and real-run rows remain zero.
- Runtime executor flags for `tempCleanupExecutor`, `downloadsCleanupExecutor`, `largeFileArchiveExecutor`, `projectDependencyExecutor`, `gradleCacheExecutor`, `npmCacheExecutor`, `pnpmStoreExecutor`, `recycleBinExecutor`, `browserCacheExecutor`, and `toolNativePruneExecutors`; capture each independently.
- Active agent question and question queue state.
- Per-check validation evidence records with reviewer, timestamp, artifact path, and notes.
- Public beta readiness state.
- Native beta distribution evidence records, including reviewer, artifact path, notes, and completion state.
- Redacted support bundle.
- Redacted workflow handoff.
- Beta handoff manifest with public-safe, support-safe, internal-evidence, and path-level artifact scopes.
- Local evidence backup if the reviewer needs to resume evidence ledgers or dry-run history in another browser profile.
- Manual strategy checklist state for backup, archive, move, uninstall, or partition-prep evidence.
- Structured installed-app review signals, including explicit `usage proof = not proven` evidence when no true app-usage source exists, or `UserAssist launch evidence` when read-only Windows launch-history names match an app candidate.
- Installed-app `metadataSources` and `evidenceSummary` source coverage: uninstall registry scanned/unavailable, UserAssist scanned/unavailable, source row counts, registry matches, UserAssist matches, missing usage-proof count, manual-only flag, and no executor authority.
- App uninstall review dossier status, manual-only flag, selected follow-up bytes, uninstall-entry count, source coverage summary, and no executor authority.
- App uninstall work order status, selected app rows, no-uninstall-string guardrail, manual-only flag, exported artifact path, and post-uninstall native rescan result.
- WSL compaction work order status, measured `ext4.vhdx` rows, typed acknowledgement, backup/export evidence, no-shell-execution guardrail, exported artifact path, distro boot verification, and post-compaction native rescan result.
- Scoped real cleanup status: enabled executor route list, broad cleanup locked state, feature flags, current plan id, scan fingerprint, consent receipt, and target-validation result.
- Executor smoke-run packet export with route checks, request mode, blockers, and post-run proof export checklist.
- Item review decisions and protected-path exclusions.
- Executor manifest selected routes.
- Tool command inventory state for npm, pnpm, Docker, Gradle, and Windows cleanup command validation.
- Local validation evidence ledger state.
- Fixture evidence import result and mapped check ids.
- Dry-run scope evidence cases showing at least one allowed first-safe target and one rejected target with zero candidate samples.
- Dry-run consent receipt, plan id, and plan-lock id.
- Post-run verification checklist.
- Rescan comparison state, including ledger timestamp, native scan timestamp, matched rows, waiting rows, and mismatches.
- Write-readiness state with every final real-execution blocker.
- Real executor capsule route, code-path status, missing checks, and destructive-action availability.
- First-safe validation gate status, route-required checks, fixture coverage, unsafe runtime status, and `realRunAllowed=false`.
- First-safe work order status, build items, acceptance tests, feature flag, boundary reprobe state, and `realRunAllowed=false`.
- Temp executor activation status, route flag state, scaffold status, preflight count, blockers, `activationAllowed=false`, and `mutationEnabled=false`.
- Temp activation rehearsal status if using the no-real-data demo path; this evidence must be labeled demo-only and must not replace native write-boundary proof.
- Disabled temp executor scaffold status when probing `known-temp-delete`: route, `tempCleanupExecutor`, validation-required state, mutation disabled, and zero bytes.
- Gradle cache executor status when selected: route `bounded-cache-delete`, `gradleCacheExecutor`, scanned `.gradle\caches` target evidence, old-file threshold, skipped lock/recent counts, and reclaimed bytes from the native response.
- User `.cache` executor status when selected: route `bounded-user-cache-delete`, `userCacheExecutor`, scanned `%UserProfile%\.cache` target evidence, 30-day threshold, skipped config/database/session/credential/project counts, and reclaimed bytes from the native response.
- Android cache executor status when selected: route `bounded-android-cache-delete`, `androidCacheExecutor`, scanned Android Studio cache target evidence, 30-day threshold, skipped AVD/SDK/emulator/project/config counts, and reclaimed bytes from the native response.
- Shader cache executor status when selected: route `launcher-cache-cleanup`, `shaderCacheExecutor`, scanned current-user LocalAppData shader cache target evidence, 14-day threshold, skipped game install/save/profile/config counts, and reclaimed bytes from the native response.
- pip cache executor status when selected: route `bounded-pip-cache-delete`, `pipCacheExecutor`, scanned `%LocalAppData%\pip\Cache` target evidence, 14-day threshold, skipped Python install/virtualenv/site-packages/config counts, and reclaimed bytes from the native response.
- npm cache executor status when selected: route `bounded-npm-cache-delete`, `npmCacheExecutor`, scanned `%LocalAppData%\npm-cache\_cacache` target evidence, 14-day threshold, skipped index/recent counts, and reclaimed bytes from the native response.
- pnpm store executor status when selected: route `bounded-pnpm-store-delete`, `pnpmStoreExecutor`, scanned `%LocalAppData%\pnpm\store` target evidence, 30-day threshold, skipped metadata/recent counts, and reclaimed bytes from the native response.
- Reviewed Downloads executor status when selected: route `item-review-recycle-bin`, `downloadsCleanupExecutor`, exact reviewed file targets, 30-day threshold, Shell Recycle Bin move evidence, and reclaimed bytes from the native response.
- Reviewed large-file archive status when selected: route `item-review-large-files`, `largeFileArchiveExecutor`, exact Move/Archive targets, archive destination, 90-day threshold, 1GB threshold, copy verification, source removal evidence, and reclaimed bytes from the native response.
- Recycle Bin executor status when selected: route `shell-recycle-bin`, `recycleBinExecutor`, scanned Recycle Bin target evidence, permanent-removal confirmation, native `permanentRemovalConfirmed=true`, and reclaimed bytes from the Shell API response.
- Browser cache executor status when selected: route `browser-cache-only`, `browserCacheExecutor`, scanned cache-root target count, identity-store rejection boundary, and reclaimed bytes from the native response.
- Write-boundary preflight rows for request shape, target allowlist, mutation lock, feature flag, and validation evidence.
- Write boundary probe state if the desktop runtime exposes `execute_cleanup_plan`; current evidence must show accepted false, rejected entries, zero bytes, matching first-safe contract echo, and no mutation.
- Exported validation pack.

Rescan comparison only counts when the native scan is taken after the current run ledger. The expected operator order is: finish item decisions, arm and run the dry-run simulation or scoped executor, use **Execution proof handoff** or verification to click **Run post-run rescan**, then inspect the rescan comparison panel. The general **Run real scan** action starts a new planning scan and clears execution state; use it for discovery, not after-ledger proof. A native scan captured before the ledger remains evidence for sizing, not parity.

After any scoped executor creates a ledger, another scoped executor should remain blocked until the proof handoff reaches `proof-complete`. Pending or mismatched proof is a stop condition, not a warning-only note.

The write response's volume proof is the immediate OS free-space probe around the accepted native executor. It is useful evidence that the drive changed, but it does not replace post-run rescan proof because route-level verification still needs current finding data and ledger comparison.

## Release Criteria

Do not implement write-capable executors until:

- Disposable VM fixture parity is repeatable.
- Validation evidence records include reviewer and artifact path for every passed check; checkbox-only legacy records do not count.
- Protected-path and browser-identity fixtures pass.
- Rollback or Recycle Bin behavior is proven for review routes, with reviewer, artifact path, and restore/backup/acknowledgement reference recorded in the rollback proof ledger.
- Ledger/rescan parity is proven.
- Write readiness is blocked only by intentionally unfinished implementation work, not by missing validation, rollback, privilege, privacy, or consent evidence.
- Real executor capsule identifies a single first-safe route and reports `destructiveActionAvailable: false` until implementation is explicit.
- Native write-boundary probe returns rejection evidence only and does not create ledger records or recovered-byte totals until real execution is intentionally implemented.
- Runtime privilege boundary is recorded.
- Real executor feature flag is intentionally enabled.
- Signed Windows build flow exists.
