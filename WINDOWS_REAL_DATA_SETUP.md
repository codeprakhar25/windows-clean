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

1. Set **Real scan settings** for project artifact inclusion, traversal depth, per-root entry cap, and optional custom read-only roots.
2. Click **Run real scan**.
3. Check **Real data readiness** for native availability, write capability, destructive command state, and C: volume evidence.
4. Add protected paths before planning any review-heavy route.
5. Use **Item review** for Downloads, large personal files, project artifacts, and Android Studio findings.
6. Use **Agent questions**, **Manual strategy checklist**, **Executor policy**, **Tool command inventory**, **Rollback plan**, **Public beta readiness**, **Release gate**, **Write readiness**, **Real executor capsule**, and **Validation evidence** to confirm real cleanup is still locked.
7. Paste the `spaceguard-fixture-evidence/v1` JSON into **Fixture evidence import** with reviewer and artifact id. This can fill only the scanner-fixture validation record.
8. Record rollback proof in **Rollback plan** only after restore, backup, or permanent-removal acknowledgement evidence exists; fill reviewer, evidence path or artifact id, and the route-specific reference.
9. Mark completed validation checks in **Validation evidence** only after the matching Windows VM evidence exists, then fill reviewer and evidence path or artifact id.
10. Use **Probe write boundary** only when the desktop runtime exposes `execute_cleanup_plan`; current evidence must show rejection, zero bytes, and no mutation.
11. Export the redacted support bundle first, then the dry-run report and validation pack when path-level evidence is needed.

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
- Real scan settings used for the native scan.
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
- Write boundary probe state if the desktop runtime exposes `execute_cleanup_plan`; current evidence must show accepted false, rejected entries, zero bytes, and no mutation.
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
