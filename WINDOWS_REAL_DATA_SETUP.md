# Windows Real-Data Setup

This guide is for moving SpaceGuard from browser demo data to real local measurements. It does not enable deletion. Real executors remain disabled until Windows validation, rollback, signing, and release gates pass.

## Safety Boundary

Current native mode is read-only:

- It measures known local roots and C: volume totals.
- It can produce native dry-run ledger entries.
- It does not delete files, edit registry keys, resize partitions, run cleanup shell commands, or self-elevate.
- Review-gated findings still require per-item decisions.

Use a disposable Windows 11 VM for fixture validation. Use your real machine only for read-only scanner smoke tests.

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
npm run build
```

## Read-Only Real Scan

Start the desktop shell:

```powershell
npm run native:dev
```

In the app:

1. Set **Real scan settings** for target drive, project artifact inclusion, traversal depth, per-root entry cap, and optional custom read-only roots.
2. Click **Run real scan**.
3. Check **Real data readiness** for native availability, write capability, destructive command state, and target-drive volume evidence.
4. Check **Scan session** and confirm the captured fingerprint is current. If target drive, custom roots, traversal caps, project-artifact setting, or protected paths changed, rerun the native scan before planning.
5. Review **Intake constraints**. Leave admin/system actions off unless this validation run intentionally includes Windows.old, hibernation, WSL compaction, or another admin-sensitive dry-run route.
6. Check **Task powers** to confirm selected routes activate only scoped powers and that admin, advanced, manual, or restricted powers stay locked or advisory as expected.
7. Check **Task grants** after arming dry-run consent. Every issued grant must be `dry-run-only`, tied to the current plan id and scan fingerprint, and must refuse issuance if runtime write capability appears.
8. Check **Task runbook** to confirm each selected cleanup target has its own next question, allowed operations, forbidden operations, evidence needs, and no cross-task authority.
9. Add protected paths before planning any review-heavy route.
10. Use **Custom root triage** for custom read-only findings. Mark each unknown folder Keep, Archive, Move, Inspect, or Escalate; these dispositions stay manual and cannot create executor routes.
11. Use **Item review** for Downloads, large personal files, project artifacts, and Android Studio findings.
12. Use **Agent questions**, **Manual strategy checklist**, **Executor policy**, **Tool command inventory**, **Rollback plan**, **Public beta readiness**, **Release gate**, **Write readiness**, **Real executor capsule**, **First-safe executor contract**, **Release review packet**, and **Validation evidence** to confirm real cleanup is still locked.
13. Paste the `spaceguard-fixture-evidence/v1` JSON into **Fixture evidence import** with reviewer and artifact id. This can fill only the scanner-fixture validation record.
14. Record rollback proof in **Rollback plan** only after restore, backup, or permanent-removal acknowledgement evidence exists; fill reviewer, evidence path or artifact id, and the route-specific reference.
15. Mark completed validation checks in **Validation evidence** only after the matching Windows VM evidence exists, then fill reviewer and evidence path or artifact id.
16. Use **Probe write boundary** only when the desktop runtime exposes `execute_cleanup_plan`; current evidence must show rejection, zero bytes, matching first-safe contract echo, and no mutation.
17. Export the redacted support bundle first, then export the release review packet, dry-run report, and validation pack when path-level evidence is needed.

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

After seeding:

1. Run `npm run native:dev`.
2. Click **Run real scan**.
3. Inspect the seeded fixture metadata:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\inspect-spaceguard-fixtures.ps1
```

4. Confirm fixture-backed findings appear as measured or limited.
5. Confirm large personal files appear in item review only, not as bulk cleanup.
6. Attach the fixture evidence JSON path to the validation pack notes.
7. Import the fixture evidence JSON in the app to create the scanner-fixture validation record.
8. Export the validation pack.
9. Restore the VM snapshot before the next validation pass.

## Evidence To Capture

For each Windows validation run, capture:

- `npm test` output.
- `npm run build` output.
- `npm run native:dev` smoke result.
- Runtime capability panel state.
- Real scan settings used for the native scan, including target drive.
- Scan session status, current fingerprint, captured fingerprint, and any changed settings.
- Intake constraints, including admin/system action allowance.
- Task powers state, including active, waiting, locked, advisory, blocked, and real-run-disabled rows.
- First-safe executor contract status, request mode, selected route, target-scope audit, allowed targets, forbidden targets, and write-disabled state.
- Custom root discovery rows, if any; these are manual-review evidence and not executor routes.
- Native scan volume totals.
- Active agent question and question queue state.
- Per-check validation evidence records with reviewer, timestamp, artifact path, and notes.
- Public beta readiness state.
- Redacted support bundle.
- Manual strategy checklist state for backup, archive, move, uninstall, or partition-prep evidence.
- Item review decisions and protected-path exclusions.
- Executor manifest selected routes.
- Tool command inventory state for npm, pnpm, Docker, Gradle, and Windows cleanup command validation.
- Local validation evidence ledger state.
- Fixture evidence import result and mapped check ids.
- Dry-run consent receipt and plan id.
- Post-run verification checklist.
- Rescan comparison state, including ledger timestamp, native scan timestamp, matched rows, waiting rows, and mismatches.
- Write-readiness state with every final real-execution blocker.
- Real executor capsule route, code-path status, missing checks, and destructive-action availability.
- Write boundary probe state if the desktop runtime exposes `execute_cleanup_plan`; current evidence must show accepted false, rejected entries, zero bytes, matching first-safe contract echo, and no mutation.
- Exported validation pack.

Rescan comparison only counts when the native scan is taken after the current dry-run ledger. The expected operator order is: finish item decisions, arm and run the dry-run simulation, run the native read-only scan again, then inspect the rescan comparison panel. A native scan captured before the ledger remains evidence for sizing, not parity.

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
