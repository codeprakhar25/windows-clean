# Public Release Research

This app can be public, but it should ship first as a non-destructive demo or read-only scanner. A Windows cleaner has a high trust burden because it requests broad local access and can damage user data.

## Feasibility

Public release is feasible if the product is positioned as:

```txt
Explainable Windows space recovery, with dry-run first and explicit cleanup gates.
```

Avoid positioning as:

```txt
One-click PC optimizer, registry cleaner, driver fixer, or performance booster.
```

## Distribution Findings

Microsoft's SmartScreen documentation says Microsoft Store distribution is the simplest path to avoid SmartScreen download warnings because Store apps are signed by Microsoft. Non-Store apps need code signing and still build file/hash reputation over time.

Source: https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation

For packaged Windows apps, broad filesystem access is a declared capability. A cleaner that scans a user's drive needs a clear permission and privacy model.

Source: https://learn.microsoft.com/en-us/windows/uwp/packaging/app-capability-declarations

Microsoft Store policies require products to avoid safety/property damage risk and to clearly disclose personal information collection. A cleanup app should therefore be local-first, transparent, and conservative.

Source: https://learn.microsoft.com/en-us/windows/apps/publish/store-policies

## Recommended Public Path

1. Public web demo with fake data.
2. Open-source recipe and guardrail policy.
3. Read-only Windows scanner build.
4. Signed beta with deletion disabled by default.
5. Add low-risk cleanup executors.
6. Microsoft Store submission after privacy policy, support docs, and uninstall behavior are ready.

## Privacy Position

Default stance:

- No cloud upload.
- No telemetry until explicitly added and documented.
- Scan reports stay local.
- Paths can be exported only by user action.
- Never collect filenames by default for analytics.

## Security Position

Default stance:

- Signed builds only.
- Dry-run first.
- No script marketplace in early versions.
- No registry cleaning.
- No driver updater.
- No partition writes.
- No self-elevation loops.
- Admin actions isolated from normal user actions.

## Public Demo Constraints

The current demo is safe to publish as a web app because:

- It uses fixed sample data.
- It does not request filesystem permissions.
- It does not execute cleanup commands.
- It clearly says "demo data only."

## Native Beta Constraints

The current native shell should be marketed only as a read-only scanner:

- It can measure known local roots through a Rust Tauri command.
- It lets users set read-only traversal depth, entry caps, and project artifact inclusion before scanning.
- It keeps write capability and destructive commands disabled.
- It maps scanner findings into recipe statuses instead of guessing unsupported roots.
- It can produce native dry-run ledger entries, but real execution remains disabled.
- It has a release gate for feature flags, runtime capabilities, validation evidence, and disposable VM coverage.
- It has a visible privacy boundary for local scan metadata, explicit exports, local audit records, blocked data classes, and no telemetry/cloud upload.
- It has a rollback plan that separates rebuildable routes, reviewed-item restore paths, backup-required admin routes, and permanent Recycle Bin consequences.
- It has a public beta readiness check that separates publishable web demo, native read-only beta, and real cleanup claims.
- It has a redacted support bundle for support triage without local paths or filenames by default.
- It has a manual strategy checklist for backup, archive, library move, uninstall review, and partition-prep evidence without automating those actions.
- It has a tool command inventory for npm, pnpm, Docker, Gradle, and Windows cleanup validation without enabling shell execution.
- It has rescan comparison evidence that requires a native scan after the current dry-run ledger before any route can count as matched.
- It has a final write-readiness gate that stays locked until real executor implementation, runtime write capability, release validation, rollback proof, rescan parity, privilege evidence, privacy boundary, and current consent all pass.
- It has a real executor capsule that names the next first-safe implementation route while keeping destructive action availability false.
- It still cannot perform real cleanup.

The native app should not be marketed as capable of real cleanup until the scanner, executor, and rollback story are implemented and tested on disposable Windows VMs.
