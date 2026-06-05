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

It exists only to validate the future request shape and reject every write attempt. It checks dry-run-only state, mutation flags, plan/scan/consent evidence, first-safe route membership, per-action route matches, and selected target paths, then returns `accepted: false`, `realRunEnabled: false`, `destructiveCommands: false`, zero reclaimed bytes, reject codes, and no filesystem mutation.

For `known-temp-delete`, the native response now exposes a disabled executor scaffold: route `known-temp-delete`, feature flag `tempCleanupExecutor`, validation status `validation-required`, and mutation disabled. This is implementation evidence only; the command still rejects the request and returns zero bytes.

Each rejected write entry also carries native preflight evidence: request-shape checks, target allowlist status, mutation lock, route feature-flag state, and validation-evidence state. Preflight rows show what would block or pass before a future executor runs; they do not create cleanup authority.

The **Write boundary probe** panel can call this rejecting command from the desktop shell. A passing probe is rejection evidence only: accepted is false, every entry is rejected, reclaimed bytes are zero, and no ledger or recovery claim is created.

The **First-safe validation gate** sits between the disabled request contract and the write-boundary probe. It summarizes the selected first-safe route, required Windows validation checks, required fixtures, contract status, and runtime write signals. Passing this gate means implementation planning can start; it still reports real run allowed as false and keeps destructive actions hidden.

The **First-safe work order** turns a passed validation gate into an engineering checklist for the next executor: native implementation boundary, target allowlist, forbidden-target rejection, disposable fixture tests, rollback/rescan proof, feature flag, and kill-switch review. It is not a cleanup command and still reports real run allowed as false.

The **Temp executor activation** gate is the route-specific bridge between the disabled temp scaffold and any future real executor. It requires the known-temp route, disabled scaffold evidence, native preflight rows, the `tempCleanupExecutor` flag, validation gate, work order, release gate, and write readiness. Current builds report activation allowed as false, mutation disabled, and destructive action unavailable.

The **Temp activation rehearsal** panel is a browser-safe demo of that same route. It synthesizes rejected write-boundary evidence from the current first-safe contract, feeds it through the real activation gate, and should stop at `feature-flag-disabled`. It is demo-only evidence: no native command runs, no local path is scanned, no mutation is attempted, and it cannot satisfy Windows validation or release readiness.

The **Real data launch roadmap** panel consolidates product status and rough delivery ranges. It separates the web demo, native read-only beta, first-safe temp executor, and broader cleanup product milestones. It is evidence tracking only: estimates do not unlock real cleanup, and the roadmap still reports zero real-run rows until write readiness and release review both pass.

The **Native beta distribution** panel separates read-only beta packaging from real cleanup. It requires a current native read-only scan, local-only privacy, release/setup docs, install/uninstall path, redacted support workflow, signing or SmartScreen evidence, and no real-cleanup claim before native beta can be called ready.

The native runtime capability command is:

```txt
runtime_capabilities
```

It reports platform, scanner availability, dry-run availability, and whether real executors are enabled. In the current build, real executors are disabled.

Runtime capabilities also expose per-executor feature flags: `tempCleanupExecutor`, `recycleBinExecutor`, `browserCacheExecutor`, and `toolNativePruneExecutors`. They default to false independently, so enabling a temp executor cannot accidentally enable browser, Recycle Bin, or tool-native cleanup routes.

It currently scans or reports:

- Top-level target-drive inventory as capped read-only context.
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
- Windows setup assistant that separates browser demo, desktop shell, current read-only scan evidence, local privacy/export, native beta readiness, and the real-cleanup lock.
- Real data launch roadmap with current milestone, progress, rough estimate, confidence, demo/native activation proof, and real-cleanup lock status.
- Native beta distribution readiness for signing, setup docs, install/uninstall, support workflow, read-only scan evidence, no-cleanup claims, and exportable beta evidence records.
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
- Item review panel for Downloads, large files, old project dependencies, and Android Studio roots, with per-item Remove, Move, Archive, or Keep decisions.
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
- Post-run verification checklist that turns the current ledger into affected-root rescan checkpoints before any Windows validation can count.
- Rollback plan panel and local proof ledger that classify each selected executor route as rebuildable, restore-path-required, backup-required, permanent-warning, or blocked, then require reviewer, evidence path, and restore/backup/acknowledgement reference for proof routes.
- Local run history that persists dry-run ledger records on the device and separates current-plan records from stale audit evidence.
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

When cleanup cannot meet the requested target, the app switches to manual strategy guidance. Installed app review, custom root review, library migration, archive storage, drive upgrades, and partition work stay advisory-only; the product does not automate uninstallers, custom folder deletion, partition writes, registry edits, or bulk personal-file deletion.

Custom root triage is the follow-through for unknown local folders. The scanner can measure user-specified roots read-only, but each finding must be marked Keep, Archive, Move, Inspect, or Escalate. Archive and Move show advisory manual impact only; they do not create executor rows, recovery totals, or real cleanup permission.

Manual strategy guidance has its own checklist. The user can mark evidence such as full backup, archive destination, official uninstall path, app-native library move, save/source protection, and recovery keys. These marks are stored locally for follow-along workflow only; they do not unlock real cleanup or release gates.

User-protected paths are treated as a runtime block even if the matching recipe would normally be selectable.

Admin/system-sensitive routes are also intake-gated. Windows.old, hibernation changes, WSL compaction, and other admin-sensitive routes stay out of suggested and selectable dry-run plans until the user explicitly allows admin/system actions. Allowing them only affects dry-run planning; it does not enable real execution, self-elevation, UAC prompts, or destructive commands.

Task runbook work orders are agent-facing instructions, not new permissions. A selected cache cleanup task can ask for its own approval or enter its own dry-run simulation after grants are issued, but it cannot reuse that power for Downloads, custom roots, browser identity data, partitions, registry keys, or any sibling folder.

The restriction matrix is the refusal surface. Browser identity stores, Docker volumes, pagefile and registry tuning, partition writes, custom roots, admin/system routes, personal/project data, and tool-native shell commands each show what the agent may still do and what remains forbidden. Hard-blocked and manual-only rows cannot create executor routes, and the matrix always keeps real-run routes at zero in this build.

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

The agent questions panel is the workflow control surface. It asks for the next decision only after deriving it from current state: scan first, approve rebuildable caches, allow admin/system routes into dry-run planning when lower-risk cleanup is exhausted, review per-item decisions, arm dry-run consent, simulate the armed plan, capture validation details, or probe the rejecting write boundary. These actions reuse existing gates and cannot bypass preflight, consent, release gates, or real-execution locks.

The rescan comparison panel is stricter than the checklist. It requires an absolute ledger timestamp and a native scan timestamp newer than that ledger before any affected-root row can be marked as matched. Demo scans, stale ledgers, and scans taken before the dry-run ledger stay in a waiting state. If native bytes remain where the plan expected removal, the row is marked as a mismatch and cannot count as ledger/rescan parity evidence.

The rollback plan is evaluated before dry-run consent. Disposable and rebuildable routes require rescan proof. Reviewed user items require a visible Recycle Bin, quarantine, or archive restore location. Recycle Bin emptying is marked as permanent-removal. Admin and advanced routes require backup or recovery-state evidence. The local rollback proof ledger treats checkbox-only or legacy evidence as draft until reviewer, evidence path, and route-specific restore/backup/acknowledgement reference are filled. None of these checks unlock real cleanup in the current build.

The write-readiness panel is the final real-execution gate. It combines real executor implementation, runtime write capability, release gate status, post-run rescan parity, rollback proof, privilege boundary, privacy boundary, and current plan consent. In the current build it stays locked because no selected route exposes write-capable execution.

The real executor capsule names the next first-safe route that could become a write-capable executor. It lists the route implementation boundary, required fixtures, missing validation, code-path status, and blockers. It always reports destructive action availability separately; in the current build that value is `false`.

The first-safe executor contract turns that capsule into a concrete request-shape preview for `execute_cleanup_plan`: selected route, plan id, scan fingerprint, action ids, target paths, expected bytes, allowed targets, forbidden targets, target-scope audit, and feature flag. The contract is currently `reject-only-preview`; it is useful for validating the native boundary, not for cleanup.

The first-safe validation gate converts that route contract plus Windows validation evidence into an implementation-planning decision. It shows each route-required check, fixture coverage, unsafe runtime signals, and blockers while keeping `realRunAllowed=false` even when every route check passes.

The first-safe work order is the handoff from validation into implementation. For the selected route it lists build items, acceptance tests, fixture ids, feature flag, rollback/rescan proof, and write-boundary reprobe requirements. A ready work order means an engineer can start the disabled executor slice; it does not mean the app can delete anything.

The temp executor activation gate is the route-level decision after the work order. It explains why `known-temp-delete` still cannot become a mutating executor: missing preflight, disabled `tempCleanupExecutor`, validation blockers, release blockers, or unsafe runtime signals. Even a review-ready activation state keeps `activationAllowed=false`, `mutationEnabled=false`, and `realRunAllowed=false` in this build.

The temp activation rehearsal exists for the no-real-data demo path. It builds a synthetic rejected probe with the current contract echo, disabled scaffold, zero bytes, and per-action preflight checks. The expected rehearsal status is `rehearsal-ready` with its nested activation gate at `feature-flag-disabled`; this is presentation and workflow proof only, not native validation evidence.

The write boundary probe is separate from write readiness. It may call the native `execute_cleanup_plan` rejecting stub in the desktop shell, but success means rejection, not cleanup: `accepted=false`, all entries rejected with native reject codes, zero reclaimed bytes, and a native echo that matches the current first-safe executor contract. Target-scope reject codes are diagnostic only and do not count as passing rejection evidence. Probe entries are never ledger recovery.

When the selected route is known temp cleanup, the probe also reports the disabled `tempCleanupExecutor` scaffold. That scaffold is the first native implementation boundary to finish next; it remains feature-flag disabled until fixture, rollback/rescan, release, and support evidence pass.

The probe entry preflight checks are the native proof that request shape, target allowlist, mutation lock, feature flag, and validation state are evaluated before any executor could run. The expected current outcome for known temp is preflight passing the shape/target/mutation checks, then blocking on the disabled feature flag and missing validation evidence.

The fixture evidence import accepts the JSON produced by `scripts/inspect-spaceguard-fixtures.ps1`. It can fill the `scanner-fixtures` validation record after the fixture JSON passes schema, count, age, size, destructive-command, reviewer, and artifact checks. It can also fill `dry-run-target-scope` only when the evidence includes explicit passing dry-run scope cases with allowed and rejected targets. Use **Export scope evidence** to run the native metadata-only scope probe and create the minimal `spaceguard-native-dry-run-scope/v1` JSON consumed by the fixture inspector. Protected-path, rollback, tool-command, native-build, and ledger/rescan evidence still require their own records.

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
- Dry-run target-scope fixture evidence showing rejected targets return zero candidate samples.
- Native/runtime capability evidence.
- Selected executor routes under review.
- Full executor manifest with route status and next steps.
- Local dry-run history summary.
- Operator/reviewer signoff fields and per-check artifact paths.

The validation evidence panel lets an operator record completed checks locally after a Windows VM run. A check only counts when it has `status=passed`, a reviewer, and an evidence path or artifact id. Legacy checkbox-only records stay visible as detail-needed records. Evidence records are persisted in browser storage and exported in the validation pack, but they do not unlock real execution unless native Windows evidence, runtime feature flags, eligible routes, and every release gate also pass.

The privacy boundary is local-first by default. Native scans can include local paths and filenames in reports only when the user exports them. The current build has no cloud upload, telemetry event sender, registry collection, browser identity collection, or automatic report sync.

The public beta readiness panel is separate from the real-executor release gate. A web demo can be publishable when writes are locked and privacy is local-only. A native read-only beta additionally requires native scan evidence, public release/runbook docs, signing or SmartScreen/distribution evidence, and install/uninstall/support readiness. None of that means real cleanup is enabled.

The support bundle is the default artifact for support triage. It includes runtime mode, scan coverage, route status, release blockers, and warnings, but it intentionally excludes local paths and filenames. The full dry-run report remains a separate user-started export for cases where path-level diagnosis is required.

The workflow handoff is the default resume artifact. It includes the active agent question, next resume actions, audit state, selected workflow statuses, and the real-cleanup lock without local paths or filenames. It is not support evidence and does not grant cleanup authority.

The beta handoff manifest is the artifact index for public or native-beta sharing. It marks workflow handoff and support bundle as redacted public/support-safe rows, while validation packs, release packets, beta evidence ledgers, and full dry-run reports stay internal or path-level until explicitly approved.

The release review packet is the default artifact for deciding whether the product can move from demo/read-only validation to the next review stage. It can be ready only when every review row passes and real cleanup remains locked. Any runtime write capability, destructive command signal, accepted write-boundary result, contract mismatch, or non-zero write-boundary byte count changes the packet to `unsafe-stop`.

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

1. Complete **Demo rehearsal runbook** in browser demo mode and export the dry-run report as no-real-data proof.
2. Run `npm run native:dev` on a Windows 11 machine with the prerequisites above.
3. Use **Run real scan** to collect read-only known-root measurements and C: volume totals.
4. Review protected paths, item review, executor policy, release gate, write readiness, and real executor capsule.
5. Use **Probe write boundary** only to capture rejection evidence from the native stub.
6. Export the dry-run report and validation pack.
7. Validate fixtures in disposable Windows VMs before implementing any write-capable executor.
