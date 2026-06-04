# SpaceGuard

SpaceGuard is a guarded Windows space recovery assistant. The current app has two modes:

- Browser demo: React + Vite with fixed sample data.
- Native shell: Tauri + Rust read-only scanner for known local roots.

The native scanner measures filesystem metadata only. It does not delete data, change settings, touch partitions, call registry APIs, run shell cleanup commands, or collect cloud telemetry.

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
npm test
```

`npm run check` builds the production bundle. `npm test` verifies the cleanup guardrails, native scanner adapter, and shadcn-style React surface.

## Native Read-Only Scanner

For the full Windows setup and disposable fixture workflow, see [WINDOWS_REAL_DATA_SETUP.md](./WINDOWS_REAL_DATA_SETUP.md).

Run the desktop shell:

```bash
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

It returns ledger entries for selected routes but reports `realRunEnabled: false` and does not mutate the filesystem.

The native runtime capability command is:

```txt
runtime_capabilities
```

It reports platform, scanner availability, dry-run availability, and whether real executors are enabled. In the current build, real executors are disabled.

It currently scans or reports:

- `%TEMP%` and `C:\Windows\Temp`
- Recycle Bin
- `C:\Windows.old`
- Gradle cache
- npm cache
- pnpm store
- Downloads installers and archives
- Large personal files under user folders
- Browser cache roots only
- Android Studio cache roots
- WSL `ext4.vhdx` files
- `node_modules` folders under common project roots
- `hiberfil.sys` and `pagefile.sys` as advanced/blocked visibility

The scanner returns explicit `missing`, `measured`, `limited`, `protected`, or `unsupported` statuses so native mode does not silently reuse demo sizes for unknown roots.

The scan coverage panel turns those statuses into a confidence score. Demo-estimated, missing, protected, or unsupported roots stay visible as unverified coverage gaps; they cannot be treated as proven real-data cleanup evidence.

The real scan settings panel controls the next native read-only scan:

- Project artifact inclusion for old `node_modules` discovery.
- Traversal depth.
- Per-root entry cap.

Changing these settings clears previous native scan evidence and dry-run state so reports do not mix old measurements with new scanner limits.

For review-gated roots, the scanner can also return item-level candidates:

- Top installer/archive files under Downloads.
- Top large personal files under Downloads, Desktop, Documents, and Videos.
- Individual `node_modules` roots under common project folders.
- Top Android Studio cache or emulator entries.

These candidates are metadata-only. Large personal files are discovery-only until the user makes per-file decisions. They are shown for review and report export; they are not executable cleanup commands.

## Product Shape

SpaceGuard is not a generic PC optimizer. It is a guarded workflow:

1. Scan a Windows drive.
2. Classify raw paths into known cleanup recipes.
3. Rank actions by recoverable space and risk.
4. Ask for the correct approval gate.
5. Execute only allowed actions.
6. Rescan and produce a cleanup ledger.

The planner includes recipes for Windows temp files, Recycle Bin, Windows.old, Gradle, npm, pnpm, Docker build cache, WSL virtual disks, Android Studio, old `node_modules`, Downloads, large personal file discovery, browser cache, hibernation, pagefile, and partition strategy.

The demo also includes:

- Scenario presets for developer, gaming, and family laptops.
- Real data readiness panel for the Tauri read-only scanner.
- Native Windows volume evidence for C: total, used, and free bytes when the desktop scanner can read it.
- Real scan settings for project artifact inclusion, traversal depth, and per-root entry caps.
- Scan coverage confidence showing measured, limited, unsupported, missing, and demo-estimated cleanup roots.
- Runtime privilege boundary that shows whether the desktop shell is elevated and which selected routes would need admin validation later.
- Recovery advisor that explains the next useful move when the target is unmet.
- Storage strategy panel for manual app uninstall, archive, library move, drive upgrade, or partition planning when cleanup cannot hit the target.
- Manual strategy checklist that lets the user track backup, archive, app-native move, uninstall, and partition-prep evidence without automation.
- Review workbench that separates measured evidence, unresolved decisions, protected paths, and unsupported roots.
- Item review panel for Downloads, large files, old project dependencies, and Android Studio roots, with per-item Remove, Move, Archive, or Keep decisions.
- Decision log for source, scan, plan, gates, policy, and execution state.
- Executor policy panel that classifies selected routes before simulation.
- Executor manifest panel that shows every route family, first-safe lanes, required validation checks, fixtures, preconditions, rollback notes, and next implementation steps.
- Tool command inventory panel that lists official inspect/prune command shapes for npm, pnpm, Docker, Gradle, and Windows cleanup without executing shell commands.
- Release gate panel that shows feature flags, runtime capabilities, missing validation checks, and disposable VM coverage.
- Local validation evidence ledger and pack export with Windows VM scenarios, fixture roots, required checks, command checklist, and signoff fields.
- User-defined protected paths that remove matching actions from executable plans.
- A plan review queue separating ready, pending, protected, and policy-blocked work.
- An execution preflight checklist that blocks simulation until scan, selection, gates, protected paths, and ledger state are valid.
- Run readiness that also requires executor-policy clearance, at least one dry-run route, and real deletion still locked.
- A plan-specific dry-run consent receipt that must be armed after readiness passes and resets whenever the plan snapshot changes.
- Plan snapshot verification so a ledger is trusted only when it matches the current selected actions, approvals, protected paths, and item decisions.
- Post-run verification checklist that turns the current ledger into affected-root rescan checkpoints before any Windows validation can count.
- Rollback plan panel that classifies each selected executor route as rebuildable, restore-path-required, backup-required, permanent-warning, or blocked before real cleanup can ship.
- Local run history that persists dry-run ledger records on the device and separates current-plan records from stale audit evidence.
- Privacy boundary panel that explains local scan metadata, manual exports, local audit storage, blocked data classes, and disabled telemetry/cloud upload.
- Public beta readiness panel that separates web-demo readiness from native read-only beta readiness, including signing, support, uninstall, privacy, and claim boundaries.
- Redacted support bundle export for diagnostics that excludes local paths and filenames by default.
- A dry-run report export with selected actions, locked actions, pending gates, advisor state, decision log, and simulated ledger entries.

## Guardrail Policy

Allowed in low-risk batch:

- Known temporary files.
- Browser cache only, never identity data.
- Recycle Bin after the user starts cleanup.

Requires confirmation:

- Rebuildable tool caches.
- Windows.old.
- Docker build cache.
- Game launcher shader/download caches.

Requires item review:

- Downloads.
- Large personal files.
- Old project artifacts.
- Android emulator images and SDK packages.

Review-gated categories cannot execute from a broad category approval. The user must mark candidate items as `Remove`, `Move`, `Archive`, or `Keep`; only `Remove` item bytes are counted in selected recovery, executor previews, and the simulated ledger. `Move` and `Archive` are tracked as manual recovery intent.

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

When cleanup cannot meet the requested target, the app switches to manual strategy guidance. Installed app review, library migration, archive storage, drive upgrades, and partition work stay advisory-only; the product does not automate uninstallers, partition writes, registry edits, or bulk personal-file deletion.

Manual strategy guidance has its own checklist. The user can mark evidence such as full backup, archive destination, official uninstall path, app-native library move, save/source protection, and recovery keys. These marks are stored locally for follow-along workflow only; they do not unlock real cleanup or release gates.

User-protected paths are treated as a runtime block even if the matching recipe would normally be selectable.

Execution is blocked until the preflight passes:

- Scan complete.
- Scanner idle.
- At least one action selected.
- Approval gates resolved.
- No selected protected paths.
- Ledger has not already run for the current plan snapshot.
- Executor policy has at least one simulatable dry-run route.
- No selected executor route is policy-blocked.
- Real deletion is still disabled.
- The current plan snapshot has been armed through the final dry-run consent receipt.

Every simulation is tagged with a plan id. If the user changes selected actions, approvals, protected paths, item decisions, scan mode, or goal, the old ledger becomes stale and the current plan can be simulated again. The verification panel and exported report show whether the ledger is current, stale, missing, or needs rescan.

Final consent is also plan-specific. A user can arm only the current plan after run readiness passes. Changing selection, approvals, protected paths, review item decisions, scan mode, or goal clears the receipt and disables simulation again.

The post-run verification panel converts the current ledger into route-level checkpoints. Each checkpoint includes the affected root, expected bytes, route, and evidence required for a read-only rescan comparison. Stale ledgers cannot produce valid checkpoints for the current plan.

The rescan comparison panel is stricter than the checklist. It requires an absolute ledger timestamp and a native scan timestamp newer than that ledger before any affected-root row can be marked as matched. Demo scans, stale ledgers, and scans taken before the dry-run ledger stay in a waiting state. If native bytes remain where the plan expected removal, the row is marked as a mismatch and cannot count as ledger/rescan parity evidence.

The rollback plan is evaluated before dry-run consent. Disposable and rebuildable routes require rescan proof. Reviewed user items require a visible Recycle Bin, quarantine, or archive restore location. Recycle Bin emptying is marked as permanent-removal. Admin and advanced routes require backup or recovery-state evidence. None of these checks unlock real cleanup in the current build.

The write-readiness panel is the final real-execution gate. It combines real executor implementation, runtime write capability, release gate status, post-run rescan parity, rollback proof, privilege boundary, privacy boundary, and current plan consent. In the current build it stays locked because no selected route exposes write-capable execution.

The real executor capsule names the next first-safe route that could become a write-capable executor. It lists the route implementation boundary, required fixtures, missing validation, code-path status, and blockers. It always reports destructive action availability separately; in the current build that value is `false`.

Dry-run records are also saved to local browser storage as an append-only run history. A saved record can block a duplicate simulation for the same plan after reload, but it cannot unlock real execution. The history export is audit evidence only; real cleanup still requires native Windows validation and a post-run rescan.

Real deletion is disabled in the current build. The executor layer classifies selected actions as dry-run routes, future safe-executor candidates, gated routes, or blocked routes. Safe executors should only be enabled after Windows validation and rollback tests exist.

The executor manifest is the real-data implementation map. It covers all route families, not just selected actions:

- First-safe lanes: known temp roots, Recycle Bin boundary, and browser cache only.
- Second-safe lanes: bounded rebuildable caches, tool-native prune commands, and launcher caches.
- Later/manual lanes: Windows cleanup API, reviewed item routes, WSL compaction, hibernation, and partition strategy.
- Never lanes: Docker volumes, browser identity stores, pagefile tuning, and other policy-blocked routes.

Each manifest route lists required Windows validation checks, disposable fixtures, preconditions, proof, rollback posture, and whether real execution is still locked.

The tool command inventory is declarative only. It can show command shapes such as package-manager cache verification or Docker build-cache inventory so validation work is concrete, but the current app does not spawn shell commands, uninstall apps, run Docker prune, or execute Windows cleanup APIs.

Real cleanup remains locked until all release gates pass:

- Real executor feature flag is enabled.
- Native Windows scan evidence is available.
- Runtime privilege evidence is captured for admin-sensitive routes.
- Scanner, guardrail, executor, verification, rollback, and signing checks pass.
- Disposable Windows VM scenarios pass for standard user, admin low-disk, browser-heavy, developer-toolchain, and review-gated data profiles.
- At least one selected executor route is eligible.

Use **Export validation pack** from the app before enabling real data execution work. The pack is a markdown file with embedded JSON for:

- Required Windows validation checks.
- Disposable VM scenario checklists.
- Fixture roots to seed on test machines.
- Read-only fixture evidence generated from the seeded Windows VM files.
- Native/runtime capability evidence.
- Selected executor routes under review.
- Full executor manifest with route status and next steps.
- Local dry-run history summary.
- Operator/reviewer signoff fields.

The validation evidence panel lets an operator mark completed checks locally after a Windows VM run. These records are persisted in browser storage and exported in the validation pack. They do not unlock real execution unless native Windows evidence, runtime feature flags, eligible routes, and every release gate also pass.

The privacy boundary is local-first by default. Native scans can include local paths and filenames in reports only when the user exports them. The current build has no cloud upload, telemetry event sender, registry collection, browser identity collection, or automatic report sync.

The public beta readiness panel is separate from the real-executor release gate. A web demo can be publishable when writes are locked and privacy is local-only. A native read-only beta additionally requires native scan evidence, public release/runbook docs, signing or SmartScreen/distribution evidence, and install/uninstall/support readiness. None of that means real cleanup is enabled.

The support bundle is the default artifact for support triage. It includes runtime mode, scan coverage, route status, release blockers, and warnings, but it intentionally excludes local paths and filenames. The full dry-run report remains a separate user-started export for cases where path-level diagnosis is required.

## Native App Direction

The production shell should become a signed Windows desktop app with:

- Tauri frontend and Rust scanner service.
- Dry-run first execution model.
- Per-recipe executors that prefer official tool commands.
- Append-only local cleanup ledger.
- No cloud upload by default.

The current native slice is intentionally non-destructive. The next product milestone is Windows validation for the native scanner and dry-run executor, then real safe executors for temp files, Recycle Bin, browser cache, and tool-native prune commands.

The native runtime also reports elevation state. This is evidence only: the app does not self-elevate, request UAC, or turn admin-sensitive routes into real executors.

For real-data setup today:

1. Run `npm run native:dev` on a Windows 11 machine with the prerequisites above.
2. Use **Run real scan** to collect read-only known-root measurements and C: volume totals.
3. Review protected paths, item review, executor policy, and release gate.
4. Export the dry-run report and validation pack.
5. Validate fixtures in disposable Windows VMs before implementing any write-capable executor.
