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

## OpenAI Advisor Boundary

The OpenAI integration is advisory, not an executor.

- It receives a bounded context packet: scan mode, selected actions, candidate samples, readiness state, runtime capability flags, and policy boundaries.
- It can rank candidates, explain risk, suggest the next workflow branch, and draft questions for the user.
- It cannot scan local folders directly.
- It cannot approve consent, gates, item-review decisions, or protected-path changes.
- It cannot run shell commands, registry commands, partition operations, or native cleanup commands.
- It cannot delete, move, archive, or modify files.

All state changes still flow through deterministic UI state and native executor contracts.

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
- `risk budget`: hard ceiling that maps Safe to safe/rebuildable routes, Balanced to review-gated routes, and Emergency to advanced dry-run routes while still blocking restricted/advisory rows.
- `plan lock`: current-plan binding across plan snapshot, scan fingerprint, selected rows, risk budget, and dry-run consent; stale locks block preflight or launch.
- `agent questions`: a prioritized queue of the next user-facing questions derived from scan, plan, intake, approval, review, consent, rollback, validation, fixture import, and verification state.
- `windows setup assistant`: first-run setup state for browser demo, desktop shell, read-only scan evidence, privacy/export, native beta evidence, and real-cleanup lock.
- `real scan settings`: project artifact inclusion, traversal depth, and per-root entry cap for the next native read-only scan.
- `scan coverage`: confidence summary for measured, limited, missing, protected, unsupported, and demo-estimated roots; partial native scans must remain visibly partial.
- `storage pressure diagnosis`: an advisory explanation of why the target drive is full, ranking drive pressure, known cleanup recipes, top-level inventory, manual-review buckets, and current plan gap without creating executor routes.
- `native evidence quality`: planning-grade check for current native scan freshness, measured coverage, drive inventory, storage diagnosis, local-only privacy, and mutation lock before real-data planning.
- `custom root triage`: manual disposition workflow for custom read-only findings, with Keep, Archive, Move, Inspect, and Escalate states that cannot create executor routes.
- `storage strategy`: manual-only guidance for app uninstall review, library migration, archive storage, drive upgrades, and backup-first partition planning when cleanup cannot meet the target.
- `manual strategy checklist`: local follow-along evidence for backup, archive destination, app-native move, official uninstall path, and partition-prep readiness.
- `review workbench`: evidence status, gate, path, and next step for non-trivial findings.
- `item review`: candidate files or folders under review-gated roots, including size, age, recommendation, reason, and protected-path state.
- `decision log`: data source, scan state, plan coverage, gate state, policy boundary, and execution state.
- `user decision receipt`: current-plan receipt for selected tasks, approvals, item decisions, protected path count, admin intake, consent, active question, safe next action, and real-run lock.
- `task powers`: scoped per-task capabilities that show whether safe cleanup, rebuildable cache cleanup, reviewed item cleanup, admin cleanup, advanced system strategy, manual storage strategy, or restricted zones are active, locked, advisory, or blocked.
- `task power broker`: current-plan broker that turns selected powers into explicit user-facing power requests, preserves the active question, denies standing permission, and keeps authority dry-run only.
- `task power lease audit`: current-evidence check that verifies issued dry-run grants still match the active plan id, scan fingerprint, consent receipt, broker request, and runtime write lock.
- `task grants`: per-selected-action receipts that bind a scoped power to the current plan id, scan fingerprint, dry-run consent receipt, route, target, allowed operations, forbidden operations, and blockers.
- `task runbook`: per-selected-task work orders that expose the next user question, allowed operations, forbidden operations, evidence needs, and no cross-task authority.
- `restriction matrix`: explicit refusal surface for hard-blocked, manual-only, review-gated, intake-gated, and future-disabled cleanup classes.
- `executor policy`: dry-run route, future executor lane, blocked reason, guardrails, and verification requirement.
- `release gate`: feature flags, runtime capability, validation evidence, and disposable VM coverage before real execution.
- `executor feature flags`: native-reported per-route switches for temp, Recycle Bin, browser cache, and tool-native executors; no shared safe-executor toggle can unlock multiple routes.
- `write readiness`: final real-execution gate combining implementation, runtime write capability, validation, rollback, rescan parity, privilege, privacy, and consent.
- `real executor capsule`: selected first-safe implementation route, code-path state, fixtures, validation blockers, and destructive-action availability.
- `write boundary probe`: native rejection evidence for the future write request shape; passing evidence means rejected entries and zero bytes, not cleanup readiness.
- `tool command inventory`: declarative official command shapes for package-manager and tool-native validation without shell execution.
- `privacy boundary`: local-only data handling, explicit export, browser storage audit records, blocked collection classes, and disabled telemetry/cloud upload.
- `public beta readiness`: web-demo versus native read-only beta status, signing/support/uninstall evidence, privacy posture, and public claim boundary.
- `native beta distribution`: packaging gate for read-only beta claims, native scan evidence, local privacy, setup docs, install/uninstall path, redacted support workflow, and signing/SmartScreen evidence.
- `release review packet`: one exportable review artifact that combines plan, scan session, task grants, contract, write-boundary rejection, validation, rollback, rescan, privilege, privacy, support redaction, public claims, and real-cleanup lock evidence.
- `safety interlock`: global stop/hold surface derived from runtime write signals, native write signals, scan freshness, dry-run consent, plan lock, task power leases, broker standing permission, run readiness, write-boundary evidence, release review, and write readiness.
- `dry-run launch guard`: final execution gate that allows simulation only when run readiness, current consent, current plan lock, and the safety interlock pass while real execution remains locked.
- `operating checklist`: single operator surface for current scan evidence, active user question, run readiness, consent, launch guard, ledger evidence, and the real-cleanup lock.
- `support bundle`: redacted diagnostics for support triage that exclude local paths and filenames by default.
- `workflow handoff`: redacted resume artifact with active question, next actions, audit status, setup/demo/release state, and real-cleanup lock.
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
- Selected actions are within the current risk budget for the user tolerance mode.
- The current plan lock matches the active scan fingerprint and risk budget.
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
- The power broker is the only bridge between selected powers and task grants. It defaults to deny unless a current plan, scan, and consent-bound grant exists, and it cannot create standing permission across tasks.
- Task grants are issued only as `dry-run-only` authority. They wait on the current scan session and dry-run consent, refuse issuance when runtime write capability is visible, and expire when the plan, selection, approval state, protected paths, or scanner settings change.
- Task power leases are the current-use audit for those grants. A lease is usable only when the grant evidence still matches the active plan id, scan fingerprint, dry-run consent receipt, broker request, and runtime write lock; stale, waiting, blocked, unsafe, or standing-permission leases must be denied.
- Task runbook work orders can summarize and sequence selected task grants, but they cannot add authority, reuse one task power for another target, or bypass the selected route boundary.
- The restriction matrix is authoritative for refusal classes. Hard-blocked, advisory-only, manual-only, and future-disabled rows cannot create executor routes, cannot count real-run routes, and cannot be bypassed by task powers, runbook work orders, validation records, or release packets.
- The setup assistant can list non-destructive setup commands and UI exports, but it cannot list direct delete, registry, power-setting, format, partition, or cleanup shell commands.

Safety interlock invariant:

- Unsafe runtime write signals, destructive command visibility, native write capability, standing permission, write-boundary unsafe signals, release-review write signals, or real-execution readiness force a stop state.
- Stale leases, blocked leases, missing current scan evidence, stale plan lock, missing dry-run consent, or failed run readiness hold dry-run simulation.
- Release evidence that is not needed for current dry-run can remain waiting without creating cleanup authority.
- The interlock can allow dry-run simulation only; it never grants real execution.
- The interlock must be rebuilt after any plan, scan, approval, protected-path, scanner-setting, consent, runtime, or write-boundary change.
- The dry-run launch guard is the final authority for simulation. UI buttons and execution handlers must both refuse launch unless the guard is ready.

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
- `execute-first-safe` is currently limited to `known-temp-delete`.
- The first-safe temp executor requires Windows, `SPACEGUARD_ENABLE_TEMP_EXECUTOR=1`, current plan/scan/consent IDs, and target allowlist success.
- The first-safe temp executor deletes files only, skips symlinks and recent files, never removes folders, and returns a ledger-style native response.
- `execute-project-deps` is limited to reviewed `node_modules` targets with parent `package.json` evidence.
- The project dependency executor requires Windows, `SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR=1`, item-review Remove decisions, current plan/scan/consent IDs, and target validation.
- Expo and React Native package hints can raise priority, but they never auto-approve cleanup.
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
- Preserve native dry-run candidate metadata as preview evidence only; sampled candidate files and skipped counts are not real cleanup proof, and rejected target scopes must return no file samples.

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
- The contract must include plan id, route, selected action ids, selected target paths, expected bytes, scan-session fingerprint, allowed targets, forbidden targets, and feature flag.
- The selected route paths must pass the contract target audit: allowed target rule matched, no forbidden target rule hit, and route id matches the contract.
- Contract status cannot imply cleanup; current mode is `reject-only-preview`.
- Runtime `realRunEnabled`, `destructiveCommands`, or capsule `destructiveActionAvailable` signals violate the disabled-contract assumption and block release review.

First-safe validation gate invariant:

- The gate can mark a selected first-safe route as ready for implementation planning only after its route-required Windows validation checks and disabled executor contract pass.
- The gate must list required fixtures, missing route checks, unsafe runtime signals, and blockers before any write-boundary probe or implementation work is trusted.
- Passing the gate cannot unlock cleanup. `realRunAllowed`, `realRunEnabled`, and `destructiveActionAvailable` remain `false`.
- Runtime `realRunEnabled`, `destructiveCommands`, `safeExecutorsEnabled`, capsule destructive availability, contract write availability, or non-zero/accepted probe evidence must force `unsafe-runtime`.

First-safe implementation work-order invariant:

- The work order can be ready only after the first-safe validation gate is ready and runtime write signals are still disabled.
- It must list native executor work, target-scope enforcement, disposable fixture tests, rollback/rescan proof, feature flag, kill-switch, and rejecting-boundary reprobe requirements.
- A ready work order allows implementation planning only. It cannot expose run buttons, write capability, reclaimed bytes, or release readiness.
- Unsafe runtime or probe signals must block every work item from being marked `ready-to-build`.

Temp executor activation invariant:

- Activation review applies only to `known-temp-delete` and only after disabled scaffold and per-action native preflight evidence exist.
- The gate must name the current blocker: missing preflight, disabled `tempCleanupExecutor`, validation/work-order blockers, release/write-readiness blockers, or unsafe runtime.
- The gate is review evidence only. It must keep `activationAllowed=false`, `mutationEnabled=false`, `realRunAllowed=false`, and `destructiveActionAvailable=false` in this build.
- Demo activation rehearsal may synthesize rejected preflight evidence for presentation, but it must be marked demo-only and cannot satisfy native validation, release readiness, or write readiness.

Write boundary probe invariant:

- The probe can call `execute_cleanup_plan` only to prove the native boundary rejects the current request shape.
- Passing probe evidence requires `accepted=false`, `realRunEnabled=false`, `destructiveCommands=false`, every entry rejected, zero reclaimed bytes, and a native contract echo matching the current first-safe executor contract.
- The known-temp route may report a disabled `tempCleanupExecutor` scaffold, but scaffold presence is implementation evidence only and must keep mutation disabled.
- Every write-boundary entry must expose native preflight evidence for request shape, target allowlist, mutation lock, feature flag, and validation state before future executor work can be trusted.
- Reject codes such as `real-executor-disabled`, `temp-executor-feature-flag-disabled`, `dry-run-only-required`, `route-not-first-safe`, `route-mismatch`, or `target-forbidden` are diagnostic evidence only; they do not create cleanup authority. Target-scope reject codes do not count as passing rejection evidence.
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
- A question must not ask to simulate when the dry-run launch guard is blocked or unsafe; it must route the user to the safety interlock or launch guard instead.
- Questions cannot mark item decisions, rollback evidence, validation evidence, typed approvals, write readiness, or release gates complete on their own.
- The active question and queue must be exportable in the dry-run report for audit.

Operating checklist invariant:

- The checklist can route only to existing guarded UI actions; it cannot create approvals, validation evidence, rollback proof, release readiness, write readiness, or real cleanup authority.
- If any unsafe write/destructive signal is visible, the checklist must route to safety review and suppress actionable simulation.
- The checklist must report zero real-run rows until a separate validated real-executor release passes every final gate.

User decision receipt invariant:

- Receipts summarize current user choices; they cannot create choices, mark gates complete, or grant cleanup authority.
- Item-review receipts must distinguish Remove, Keep, Move, Archive, and undecided states; only Remove can contribute to dry-run executor preview.
- Receipts must include the protected-path count and real-run lock, and must report zero real-run rows in this build.
- If runtime write or destructive signals are visible, receipts must switch to unsafe-stop instead of honoring the recorded decisions.

Plan lock invariant:

- A plan lock binds plan snapshot id, selected rows, scan fingerprint, risk mode, risk ceiling, and risk status.
- Preflight requires a current plan lock before dry-run routes are considered ready.
- Consent must store both the current plan id and current plan-lock id.
- Changing scan evidence, selection, approvals, protected paths, risk mode, or goal must stale or clear consent before launch.
- A stale plan lock can never be repaired by task grants, release evidence, validation records, or the safety interlock.
- Plan locks are dry-run evidence only and always report zero real-run authority.

Risk budget invariant:

- Safe mode can include only safe and rebuildable dry-run routes.
- Balanced mode can additionally include review-gated routes after item decisions are complete.
- Emergency mode can additionally include advanced dry-run routes, but it cannot bypass typed acknowledgements, admin intake, rollback, release, consent, or real-run locks.
- Restricted and advisory rows are outside every risk budget and cannot become dry-run or real-run routes.

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
- Imported fixture evidence can satisfy the scanner-fixture readiness record after schema, pass/fail, destructive-command, reviewer, and artifact checks pass. It can satisfy dry-run target-scope validation only when explicit allowed and rejected dry-run scope cases pass with zero samples for rejected targets.
- Fixture import cannot satisfy protected-path, rollback, command, native-build, privilege, privacy, or ledger/rescan proof.
- Evidence records can support release review but cannot bypass native runtime, route eligibility, feature flags, rollback, rescan parity, privilege, privacy, or consent.

Public beta invariant:

- Web-demo readiness is not native-beta readiness.
- Native read-only beta readiness is not real-cleanup readiness.
- Public beta requires local-only privacy, no real-cleanup claims, distribution/signing/support/uninstall evidence, and the Windows real-data runbook.
- Native beta distribution evidence can publish read-only scanner claims only; it cannot satisfy release review, write readiness, rollback proof, or executor validation.
- Real-executor release gates remain separate and stricter.

Demo rehearsal invariant:

- Browser-demo rehearsal is no-real-data proof only.
- It can include demo scan, selected plan, approvals, task-scoped dry-run consent, simulated ledger, and report export.
- It must expose `requiresNativeData=false`, `realCleanupEnabled=false`, destructive commands disabled, and zero real-run routes.
- It cannot count as native scanner validation, fixture evidence, release-gate evidence, write readiness, or real Windows cleanup proof.

Product completion audit invariant:

- The audit must map the product goal to current evidence rows instead of summarizing optimistic intent.
- It can mark demo workflow, read-only native scan, privacy, restrictions, brokered task powers, and reports as proven only when the corresponding runtime artifact exists.
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

Workflow handoff invariant:

- Handoffs are resume guidance, not support diagnosis or release evidence.
- They must include the active question, next actions, product audit state, and real-cleanup lock while excluding local paths and filenames.
- They cannot grant cleanup authority, satisfy validation, or replace the full dry-run report when path-level diagnosis is needed.

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
- Dry-run target-scope evidence in the validation pack when fixture import proves the scope cases.
- Native dry-run scope evidence export for disposable VM fixture inspection, without raw candidate filename samples.

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

It returns native dry-run ledger entries plus bounded candidate metadata for first-safe routes only. It must reuse the native first-safe target allowlist before candidate enumeration and return target-scope rejection metadata without file samples when the path is missing, forbidden, or not allowlisted. It must report `realRunEnabled: false` and `destructiveCommands: false` unless the dedicated temp executor flag is enabled in the native runtime.

The third native command is:

```txt
execute_cleanup_plan
```

It is a rejecting write boundary for dry-run probes and the native entrypoint for first-safe execution. Rejecting probes must validate dry-run-only state, mutation flags, plan/scan/consent evidence, first-safe route membership, per-action route matches, and selected target paths, then return `accepted: false`, native reject codes, and zero reclaimed bytes for every entry.

For `known-temp-delete`, `requestMode=execute-first-safe` may delete old files under allowlisted temp roots when `SPACEGUARD_ENABLE_TEMP_EXECUTOR=1` is present on Windows.

For `node-modules-old`, `requestMode=execute-project-deps` may remove reviewed dependency targets when `SPACEGUARD_ENABLE_PROJECT_DEPS_EXECUTOR=1` is present on Windows. The target must be a `node_modules` directory, the parent project must contain `package.json`, and the UI must send only item-review targets marked Remove.

Every other route remains rejecting or advisory.

Each rejected write entry returns preflight checks. For the temp scaffold, shape, target allowlist, and mutation lock can pass while feature flag and validation evidence remain blocked or waiting.

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
