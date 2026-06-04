# SpaceGuard Agent Design

## Mission

The agent's job is not to "clean the PC." Its job is to recover C-drive space through an explainable, gated, reversible-where-possible workflow.

Primary objective:

```txt
Maximize useful reclaimed space while minimizing accidental data loss and trust loss.
```

## Agent Contract

The agent must always produce:

- What was found.
- Why it matters.
- How much space is likely recoverable.
- What the consequence is.
- What approval is required.
- What the next recovery strategy is if the current plan misses the target.
- What decision state controls execution.
- What executor route would be used, and why real execution is enabled or disabled.
- What was executed or skipped.
- What changed after verification.

The agent must never silently:

- Delete personal files.
- Delete unknown app data.
- Touch browser identity stores.
- Touch Docker volumes.
- Tune pagefile.
- Modify registry.
- Resize partitions.
- Delete from Windows system directories.

## Workflow State Machine

### 1. Intake

Inputs:

- Target drive.
- Desired free-space goal.
- User tolerance: safe, balanced, emergency.
- Protected paths.
- Whether admin actions are allowed.
- Demo or production scenario context.

Output:

- A cleanup budget and risk ceiling.

### 2. Discovery

Collectors:

- Drive usage summary.
- Top-level folder sizes.
- Known user cache roots.
- Known developer tool roots.
- Installed package managers and CLIs.
- Virtual disk files.
- Large files by age and type.
- Windows cleanup opportunities.

Production scanner should prefer structured APIs or tool-native commands where possible. Raw recursive deletion is a last resort.

### 3. Classification

Every finding becomes one of:

- `safe`: disposable, low-value temporary data.
- `rebuildable`: cache/build data that can be recreated.
- `review`: personal, project, or app-specific data requiring inspection.
- `advanced`: system behavior change requiring typed approval.
- `restricted`: visible but blocked.
- `advisory`: strategy only.

Unknown paths default to `review` or `restricted`, never `safe`.

### 4. Planning

Plan order:

1. Safe cleanup.
2. Rebuildable caches.
3. Large-file review.
4. Advanced reversible settings.
5. Advisory strategies.

The planner stops once the target is met unless the user asks for an emergency pass.

The UI must expose a review queue before execution:

- `approved`: selected actions whose gates are satisfied.
- `pending`: selected actions waiting for confirmation, review, or typed acknowledgement.
- `protected`: actions matching user-protected paths.
- `blocked`: policy-blocked or advisory-only actions.

The UI must also expose a recovery advisor and decision log:

- `recovery advisor`: the current gap, the reason the goal is or is not reachable, and the next decision branch.
- `intake constraints`: the target drive, free-space goal, risk tolerance, protected-path count, and whether admin/system routes may enter dry-run planning.
- `agent questions`: a prioritized queue of the next user-facing questions derived from scan, plan, intake, approval, review, consent, rollback, validation, fixture import, and verification state.
- `windows setup assistant`: first-run setup state for browser demo, desktop shell, read-only scan evidence, privacy/export, native beta evidence, and real-cleanup lock.
- `real scan settings`: project artifact inclusion, traversal depth, and per-root entry cap for the next native read-only scan.
- `scan coverage`: confidence summary for measured, limited, missing, protected, unsupported, and demo-estimated roots; partial native scans must remain visibly partial.
- `custom root triage`: manual disposition workflow for custom read-only findings, with Keep, Archive, Move, Inspect, and Escalate states that cannot create executor routes.
- `storage strategy`: manual-only guidance for app uninstall review, library migration, archive storage, drive upgrades, and backup-first partition planning when cleanup cannot meet the target.
- `manual strategy checklist`: local follow-along evidence for backup, archive destination, app-native move, official uninstall path, and partition-prep readiness.
- `review workbench`: evidence status, gate, path, and next step for non-trivial findings.
- `item review`: candidate files or folders under review-gated roots, including size, age, recommendation, reason, and protected-path state.
- `decision log`: data source, scan state, plan coverage, gate state, policy boundary, and execution state.
- `task powers`: scoped per-task capabilities that show whether safe cleanup, rebuildable cache cleanup, reviewed item cleanup, admin cleanup, advanced system strategy, manual storage strategy, or restricted zones are active, locked, advisory, or blocked.
- `task grants`: per-selected-action receipts that bind a scoped power to the current plan id, scan fingerprint, dry-run consent receipt, route, target, allowed operations, forbidden operations, and blockers.
- `task runbook`: per-selected-task work orders that expose the next user question, allowed operations, forbidden operations, evidence needs, and no cross-task authority.
- `restriction matrix`: explicit refusal surface for hard-blocked, manual-only, review-gated, intake-gated, and future-disabled cleanup classes.
- `executor policy`: dry-run route, future executor lane, blocked reason, guardrails, and verification requirement.
- `release gate`: feature flags, runtime capability, validation evidence, and disposable VM coverage before real execution.
- `write readiness`: final real-execution gate combining implementation, runtime write capability, validation, rollback, rescan parity, privilege, privacy, and consent.
- `real executor capsule`: selected first-safe implementation route, code-path state, fixtures, validation blockers, and destructive-action availability.
- `write boundary probe`: native rejection evidence for the future write request shape; passing evidence means rejected entries and zero bytes, not cleanup readiness.
- `tool command inventory`: declarative official command shapes for package-manager and tool-native validation without shell execution.
- `privacy boundary`: local-only data handling, explicit export, browser storage audit records, blocked collection classes, and disabled telemetry/cloud upload.
- `public beta readiness`: web-demo versus native read-only beta status, signing/support/uninstall evidence, privacy posture, and public claim boundary.
- `release review packet`: one exportable review artifact that combines plan, scan session, task grants, contract, write-boundary rejection, validation, rollback, rescan, privilege, privacy, support redaction, public claims, and real-cleanup lock evidence.
- `support bundle`: redacted diagnostics for support triage that exclude local paths and filenames by default.
- `validation evidence`: disposable VM checklists, seeded fixture roots, required commands, selected executor routes, reviewer/artifact records, and signoff fields.
- `validation evidence ledger`: local operator records for completed Windows validation checks; evidence can reduce missing checks only when reviewer and artifact path are present, and it cannot bypass native runtime, feature-flag, route, or safety gates.
- `verification`: current plan id, expected bytes, ledger bytes, stale-ledger state, and next verification steps.
- `rollback plan`: selected executor routes classified by restore posture, required proof, permanent-removal risk, backup needs, and whether a post-run checkpoint exists.

Execution preflight must pass before the agent simulates or performs any action:

- Scan is complete.
- Scanner is idle.
- At least one action is selected.
- All selected approval gates are resolved.
- No selected action matches a protected path.
- The current plan snapshot has not already produced a ledger.
- Executor policy exposes at least one dry-run route.
- No selected executor route is policy-blocked.
- Real deletion is still locked.

### 5. Gatekeeping

Gate types:

- `auto`: selected by default after user starts cleanup.
- `groupConfirm`: one explicit approval for rebuildable caches.
- `permanentConfirm`: one explicit approval for permanent-removal routes such as Recycle Bin emptying.
- `review`: per-item approval.
- `typed`: exact phrase required.
- `blocked`: cannot run.
- `advisory`: explain only.
- `protected`: matched a user-protected path and is removed from executable plans.

Blocked gates remain visible so the user understands where space exists and why the app refuses to touch it.

Task power invariant:

- Task powers are narrow route capabilities, not a global admin mode.
- A selected action can activate only the matching scoped power.
- A power cannot bypass scan, intake, protected-path, approval, item-review, typed, rollback, release, or write-readiness gates.
- `admin-cleanup` and `advanced-system-strategy` stay locked until the user allows admin/system dry-run routes at intake.
- `restricted-zones` stays blocked even when selected data has visible size.
- `manual-storage-strategy` can track evidence and next steps but cannot create executor rows.
- Every power reports real execution unavailable until a future native executor, validation evidence, rollback proof, privilege boundary, privacy boundary, and consent path all pass.
- Task grants are issued only as `dry-run-only` authority. They wait on the current scan session and dry-run consent, refuse issuance when runtime write capability is visible, and expire when the plan, selection, approval state, protected paths, or scanner settings change.
- Task runbook work orders can summarize and sequence selected task grants, but they cannot add authority, reuse one task power for another target, or bypass the selected route boundary.
- The restriction matrix is authoritative for refusal classes. Hard-blocked, advisory-only, manual-only, and future-disabled rows cannot create executor routes, cannot count real-run routes, and cannot be bypassed by task powers, runbook work orders, validation records, or release packets.
- The setup assistant can list non-destructive setup commands and UI exports, but it cannot list direct delete, registry, power-setting, format, partition, or cleanup shell commands.

Review gate invariant:

- A selected review-gated category is not executable by category approval alone.
- Every visible review candidate must be marked `Remove`, `Move`, `Archive`, or `Keep`.
- Protected candidates are forced to `Keep`.
- Only `Remove` item bytes count toward selected recovery, executor preview, and ledger output.
- `Move` and `Archive` item bytes are manual recovery intent and cannot create executor rows.
- If all items are kept, the action should be unselected rather than simulated as cleanup.

### 6. Execution

Execution rules:

- Dry-run before real run.
- Prefer official commands: Storage Sense/Disk Cleanup, package-manager prune, Docker prune.
- Direct delete only for known disposable folders and only after checking active locks.
- Use Recycle Bin or quarantine for review files where possible.
- Stop on unexpected permission or path expansion.
- Log every action.

### 7. Verification

After execution:

- Rescan affected roots.
- Compare expected and actual reclaimed space.
- Mark skipped actions.
- Produce a local ledger.

Ledger invariant:

- Every simulated ledger entry is tied to a plan snapshot id.
- A plan snapshot includes selected actions, planned bytes, scan mode, scan-session fingerprint, target, protected paths, typed approvals, and review item decisions.
- Native scan evidence is current only when its captured target drive, custom roots, traversal caps, project-artifact setting, and protected paths match the active scan settings.
- A ledger from another plan is stale evidence; it can be exported for audit but cannot verify the current plan.
- Duplicate simulation is blocked only when a ledger already exists for the current plan snapshot.
- Local run history stores dry-run records as append-only audit evidence and separates current-plan records from stale records.
- Persisted dry-run history can block duplicate simulation for the same plan after reload, but it cannot unlock real execution.

Post-run verification invariant:

- Only the current plan ledger can generate affected-root verification checkpoints.
- Each checkpoint must identify the route, affected root, expected bytes, ledger result, and required rescan evidence.
- Demo-mode checkpoints are instructions only; Windows validation requires native read-only rescan evidence.
- Stale ledgers remain exportable audit history but cannot prove ledger/rescan parity for the current plan.

Rescan comparison invariant:

- Each simulated ledger entry carries an absolute `executedAt` timestamp.
- A native scan can count as post-run evidence only when its `generatedAt` timestamp is newer than the current ledger timestamp.
- Affected-root rows compare expected remaining bytes against measured native remaining bytes with a fixed tolerance.
- Missing findings, unsupported findings, stale ledgers, demo mode, and pre-ledger native scans cannot prove parity.
- Skipped ledger rows stay visible as skipped evidence and never become reclaimed-space proof.

Write-readiness invariant:

- Release validation alone cannot enable real cleanup.
- A selected route must expose an implemented real executor, and the native runtime must explicitly report write/destructive capability.
- The current plan must also have matched post-run rescan parity, clean rollback posture, privilege boundary evidence, local-only privacy boundary, and current plan consent.
- If any selected route only supports dry-run simulation, write readiness remains `implementation-locked`.

Real executor capsule invariant:

- The app must name the next first-safe executor route before implementation starts.
- The capsule must expose implementation boundary, fixture requirements, missing validation checks, blockers, and code-path status.
- `destructiveActionAvailable` is independent of route planning and remains `false` until a real Tauri executor command exists and all final gates pass.
- Capsule planning cannot create a run button or bypass write readiness.

First-safe executor contract invariant:

- A first-safe route can produce only a disabled request-shape preview until real executors are implemented.
- The contract must include plan id, route, selected action ids, expected bytes, scan-session fingerprint, allowed targets, forbidden targets, and feature flag.
- The selected route paths must pass the contract target audit: allowed target rule matched, no forbidden target rule hit, and route id matches the contract.
- Contract status cannot imply cleanup; current mode is `reject-only-preview`.
- Runtime `realRunEnabled`, `destructiveCommands`, or capsule `destructiveActionAvailable` signals violate the disabled-contract assumption and block release review.

Write boundary probe invariant:

- The probe can call `execute_cleanup_plan` only to prove the native boundary rejects the current request shape.
- Passing probe evidence requires `accepted=false`, `realRunEnabled=false`, `destructiveCommands=false`, every entry rejected, zero reclaimed bytes, and a native contract echo matching the current first-safe executor contract.
- Probe entries cannot create ledger records, recovery totals, release-gate credit, or write-readiness credit.
- Any accepted, destructive, real-run-enabled, non-rejected, non-zero-byte, or contract-mismatched signal is unsafe and blocks release review.

Rollback invariant:

- Every selected executor route must have a rollback posture before real implementation work starts.
- Disposable and rebuildable routes can use recreate-or-rescan proof.
- Reviewed personal files require a visible Recycle Bin, quarantine, or archive restore location before real cleanup.
- Recycle Bin emptying must be treated as permanent-removal, not reversible cleanup.
- Admin and advanced routes require backup or recovery-state evidence.
- Proof-route evidence requires reviewer, artifact path, and restore/backup/acknowledgement reference before it can clear rollback-proof blockers.
- Legacy or checkbox-only rollback evidence remains draft evidence and cannot satisfy write readiness.
- Rollback evidence can support release review but cannot bypass dry-run, native validation, consent, or feature-flag gates.

Run readiness invariant:

- Workflow preflight is necessary but not sufficient.
- The executor policy layer must also be ready before simulation starts.
- A selected action set with no valid dry-run route is blocked even if scan, gates, and protected-path checks pass.
- Simulation remains allowed only while real deletion is disabled in the current build.

Consent receipt invariant:

- Run readiness is necessary but not sufficient.
- The current plan snapshot must be explicitly armed before simulation.
- Consent is tied to one plan id and is cleared by any plan-affecting change.
- Consent can arm dry-run simulation only; it cannot unlock real execution.

Agent question invariant:

- Questions are derived from current state, not hardcoded walkthrough copy.
- A question can trigger only an existing guarded action such as scan, suggest plan, allow admin/system routes into dry-run planning, confirm permanent-removal routes, focus item review, focus rollback proof, focus fixture import, approve rebuildable cache group, arm dry-run consent, simulate dry-run, run native read-only scan, or probe the rejecting write boundary.
- Questions cannot mark item decisions, rollback evidence, validation evidence, typed approvals, write readiness, or release gates complete on their own.
- The active question and queue must be exportable in the dry-run report for audit.

Executor manifest invariant:

- Every executor route family has an explicit manifest row before real implementation work starts.
- Unknown routes default to blocked.
- A manifest row must include validation checks, fixture coverage, preconditions, implementation boundary, rollback posture, and proof requirements.
- First-safe lanes can be prioritized, but they still remain real-run locked until Windows validation and release gates pass.

Tool command inventory invariant:

- Command inventory is evidence planning only.
- The app may display official inspect/prune command shapes, but it must not spawn shell commands in the current build.
- Docker volumes, running containers, global package removal, project source directories, registry cleanup, and direct system-directory deletion stay blocked.
- Tool-native command evidence must be captured in disposable Windows VMs before any executor flag can be considered.

Validation evidence invariant:

- Checkbox-only evidence is a draft marker, not release proof.
- A validation check can pass only with `status=passed`, reviewer, evidence path or artifact id, and persisted timestamp.
- Legacy `passed` records remain visible as detail-needed evidence and cannot open release gates.
- Imported fixture evidence can satisfy only the scanner-fixture readiness record after schema, pass/fail, destructive-command, reviewer, and artifact checks pass.
- Fixture import cannot satisfy protected-path, rollback, command, native-build, privilege, privacy, or ledger/rescan proof.
- Evidence records can support release review but cannot bypass native runtime, route eligibility, feature flags, rollback, rescan parity, privilege, privacy, or consent.

Public beta invariant:

- Web-demo readiness is not native-beta readiness.
- Native read-only beta readiness is not real-cleanup readiness.
- Public beta requires local-only privacy, no real-cleanup claims, distribution/signing/support/uninstall evidence, and the Windows real-data runbook.
- Real-executor release gates remain separate and stricter.

Demo rehearsal invariant:

- Browser-demo rehearsal is no-real-data proof only.
- It can include demo scan, selected plan, approvals, task-scoped dry-run consent, simulated ledger, and report export.
- It must expose `requiresNativeData=false`, `realCleanupEnabled=false`, destructive commands disabled, and zero real-run routes.
- It cannot count as native scanner validation, fixture evidence, release-gate evidence, write readiness, or real Windows cleanup proof.

Product completion audit invariant:

- The audit must map the product goal to current evidence rows instead of summarizing optimistic intent.
- It can mark demo workflow, read-only native scan, privacy, restrictions, task powers, and reports as proven only when the corresponding runtime artifact exists.
- Real cleanup remains `future-locked` until write readiness, release review, executor capsule, validation evidence, rollback, rescan, consent, and native runtime evidence all pass together.
- The audit cannot mark `productComplete=true` while real cleanup is locked or while any unsafe runtime write signal is visible.

Manual strategy invariant:

- Manual storage actions are tracked, not executed.
- Installed app review, custom root review, library moves, archive moves, drive upgrades, and partition work remain user-owned.
- Manual evidence can help the user follow along, but it cannot unlock executor routes, release gates, or real cleanup.
- Custom root discovery can create manual review checklist rows, but it cannot create executor routes or automated folder cleanup.
- Custom root triage can show advisory manual impact for Archive or Move dispositions, but that impact cannot count as selected recovery, ledger recovery, release evidence, or write readiness.
- Partition and drive planning requires backup and recovery-key evidence before advice is considered ready.

Support bundle invariant:

- Default support exports must not include local paths or filenames.
- Support bundles may include recipe ids, statuses, byte counts, runtime state, release blockers, warning counts, and selected route summaries.
- Path-level diagnosis requires a separate explicit dry-run report export.

## Recipe Schema

```json
{
  "id": "gradle-cache",
  "title": "Gradle dependency and build cache",
  "detect": ["%UserProfile%\\.gradle\\caches"],
  "risk": "rebuildable",
  "gate": "groupConfirm",
  "executor": "delete-old-cache-entries",
  "preconditions": ["path-owned-by-user", "not-system-path"],
  "consequence": "Future builds may re-download dependencies.",
  "rollback": "Recreated by Gradle."
}
```

## Public Demo Agent

The current React/shadcn app implements this as a guarded planner with browser-demo and native-read-only modes:

- Static sample C-drive profile.
- Multiple sample scenarios.
- Known cleanup recipes.
- Real scan settings for read-only native traversal limits.
- Goal-based plan suggestion.
- User-protected path blocks.
- Plan review queue.
- Approval gates.
- Blocked risky actions.
- Simulated execution ledger.
- Plan-specific dry-run consent receipt.
- Demo rehearsal runbook for scan-to-report proof without native data.
- Post-run verification checklist.
- Local run history panel.
- Exportable dry-run report.
- Tauri bridge detection.
- Read-only native scan adapter.
- Read-only native volume totals for the target drive.
- Runtime privilege boundary for elevated versus standard-user desktop shells.
- Native findings mapped back to recipe sizes and statuses.
- Recovery advisor.
- Review workbench.
- Item review panel.
- Decision log.
- Executor policy panel.
- Executor manifest panel.
- Validation evidence pack export.

No real cleanup is performed yet.

## Native Scanner Contract

The first native command is:

```txt
scan_known_roots
```

The second native command is:

```txt
simulate_cleanup_plan
```

It returns native dry-run ledger entries only. It must report `realRunEnabled: false` and `destructiveCommands: false` until real executors are explicitly implemented and validated.

The third native command is:

```txt
execute_cleanup_plan
```

It is a rejecting write boundary for future executor request-shape validation. Current builds must return `accepted: false`, `realRunEnabled: false`, `destructiveCommands: false`, and zero reclaimed bytes for every entry.

The fourth native command is:

```txt
runtime_capabilities
```

It reports platform, native command availability, the rejecting write-boundary command, and whether real executors are enabled. Current builds must report real execution disabled.

Request shape:

```json
{
  "protectedPaths": ["C:\\Users\\me\\ClientWork"],
  "targetDrive": "C:",
  "includeProjectArtifacts": true,
  "maxDepth": 8,
  "maxEntriesPerRoot": 25000,
  "customRoots": ["C:\\Users\\me\\Archives"]
}
```

Response guarantees:

- `writeCapability` is `false`.
- `destructiveCommands` is `false`.
- Target-drive volume totals are reported when Windows exposes them through read-only volume APIs.
- Runtime elevation state is reported as evidence only; the app never self-elevates.
- Every finding has a recipe id, path, byte estimate, status, and note.
- Status is one of `measured`, `limited`, `missing`, `protected`, or `unsupported`.
- Protected paths are skipped during traversal.
- Symlinks and reparse points are skipped.
- Unsupported roots return zero bytes instead of guessed data.

The frontend must treat native findings as measurement evidence only. It can update plan sizes, reports, and review queues, but it still cannot execute cleanup.

Custom scan roots are advisory native findings. They can show folder size and scanner limits, but they cannot map into cleanup actions, executor plans, release gates, or reclaimed-space claims.

Coverage confidence is not an execution gate by itself. It is evidence quality: unsupported, missing, protected, and demo-estimated roots must remain visible until a dedicated detector or native scan proves them.

Privacy evidence is not optional for public release. Native path metadata, item candidates, run history, and validation evidence stay local unless the user exports them; telemetry and cloud upload remain absent until an opt-in privacy model exists.

For review-gated roots, the native scanner may return item-level candidates. These candidates must remain advisory until the user explicitly reviews the parent action:

- Downloads candidates are installer/archive files, never arbitrary personal files by default.
- Large personal file candidates are top files under user folders; they are discovery-only until per-file review decides keep, move, archive, or remove.
- Project candidates are dependency folders such as `node_modules`, not source files.
- Android candidates are tooling/cache/emulator entries, not unknown app data.
- Protected item paths are marked `keep` and excluded from executable planning.

## Executor Policy

Executor routes are classified before simulation:

- `known-temp-delete`: future candidate for known temp roots only.
- `shell-recycle-bin`: future candidate for Recycle Bin only.
- `browser-cache-only`: future candidate for browser cache roots only.
- `tool-native-prune`: future candidate for npm, pnpm, and Docker build cache commands.
- `item-review-*`: future candidate only after item-level review.
- `advanced-*`: checklist-only until backup and typed acknowledgement are proven.
- `blocked` and `advisory`: never executable.

Current invariant:

```txt
realRunEnabled = false
destructiveCommands = false
```

Privilege invariant:

- Standard-user and elevated runtime states are shown separately.
- Admin/system-sensitive routes are blocked at intake until the user explicitly allows them in dry-run planning.
- Admin-sensitive routes remain dry-run or checklist-only until validation proves the boundary.
- The app never starts a UAC prompt or self-elevates.
- Intake allowance is plan metadata only; it cannot enable real execution, UAC prompts, shell commands, or destructive commands.

## Release Gate

Real execution is not allowed unless all of these are true:

- Real executor feature flag is enabled.
- Native Windows runtime is available.
- Scanner fixture parity is proven.
- Protected path and browser identity exclusions pass.
- Executor-specific fixtures pass for temp, Recycle Bin, and tool-native commands.
- Ledger/rescan parity is proven.
- Review-gated rollback or Recycle Bin behavior is proven.
- Signing, uninstall, privacy, and support docs are ready for public beta.

Disposable VM matrix:

- Windows 11 standard user.
- Windows 11 admin with low disk.
- Browser-heavy profile.
- Developer toolchains with Docker and WSL.
- Review-gated data profile.

Validation evidence pack:

- Required release checks with result, evidence path, notes, timestamp, and reviewer fields.
- Fixture roots for temp files, protected user roots, browser cache versus identity stores, developer tool caches, and review-gated data.
- Command checklist for `npm test`, `npm run build`, `npm run native:dev`, and `npm run native:build`.
- Executor routes currently under review with guardrails and verification expectations.
- Signoff fields that remain blocked until the release gate is satisfied.

## Production Milestones

### Milestone 1: Demo Planner

- Static demo data.
- Recipe model.
- Risk gates.
- Simulated ledger.

### Milestone 2: Local Read-Only Scanner

- Tauri app shell.
- Real folder size scanner for known roots.
- No deletion.
- Exportable scan report.
- Status: scaffolded with Rust command and frontend adapter; Linux compile is blocked in this environment by missing Tauri system packages.

### Milestone 3: Safe Executors

- Temp cleanup.
- Recycle Bin.
- Browser cache only.
- Tool-native cache prune commands.

### Milestone 4: Review Workflows

- Downloads review.
- Old project artifact review.
- Quarantine or Recycle Bin path.

### Milestone 5: Advanced Advisory

- WSL compaction checklist.
- Hibernation toggle with typed approval.
- Partition and storage-migration guidance only.
