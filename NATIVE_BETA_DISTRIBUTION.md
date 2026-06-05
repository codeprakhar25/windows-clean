# Native Beta Distribution Runbook

This runbook defines what can be shipped as a SpaceGuard native beta before real cleanup exists. It is intentionally narrower than the final product: the beta may scan local Windows storage read-only, simulate a dry-run ledger, export reports, and collect evidence records. It must not delete files, run cleanup shell commands, edit the registry, resize partitions, self-elevate, or claim recovered space from real execution.

## Ship Scope

Allowed beta claim:

```txt
Read-only Windows space recovery assistant with guarded dry-run planning.
```

Forbidden beta claims:

```txt
One-click cleanup, registry cleaner, driver updater, partition repair, real recovered space, or automatic PC optimizer.
```

The beta can be public only when the app's Native beta distribution panel shows the native beta gate as ready. Web-demo readiness is not native beta readiness.

## Install Path

For source-based beta testers:

1. Install Node.js, npm, Rust with MSVC, Microsoft C++ Build Tools, and WebView2 Runtime.
2. Run `npm install`.
3. Run `npm test`, `npm run demo:rehearsal`, `npm run native:rehearsal`, and `npm run build`.
4. Start the desktop shell with `npm run native:dev`.
5. Use the app to run a native read-only scan and export the dry-run report.

For packaged beta testers, the build artifact must be recorded with:

- Build version and commit.
- Packaging command output.
- Signing or SmartScreen/distribution evidence.
- Installer artifact path.
- Reviewer.
- Install smoke result on a disposable Windows 11 VM.

Do not distribute a package that exposes real cleanup, destructive commands, or hidden executor feature flags.

## Uninstall Path

Every beta package needs a documented uninstall path before distribution:

- Source beta: remove the checkout and local browser storage for test data if the tester wants a clean reset.
- Packaged beta: uninstall through Windows Apps settings or the installer-provided uninstall entry.
- Support must never tell users to manually delete random app data folders as a first response.
- Any retained local evidence, exported reports, or support bundles must be user-created files only.

Record uninstall proof with reviewer, artifact path, Windows version, install method, uninstall method, and result.

## Support Intake

Default support flow:

1. Ask for the redacted support bundle first.
2. Ask for the dry-run report only when the user agrees to share local path-level evidence.
3. Ask for screenshots of gate panels before asking for raw logs.
4. Do not request full directory listings, browser profiles, registry exports, or cloud sync folders by default.
5. Escalate any report involving missing files, unexpected mutation, or destructive-command visibility as a release blocker.

Support responses must describe the current build as read-only unless a separately released real executor has passed write readiness.

## Evidence To Record In The App

Use the Native beta distribution panel and fill every evidence row with status, reviewer, artifact path, and notes:

- Public release notes: link to public copy or release draft that avoids real-cleanup claims.
- Windows real-data setup: link to `WINDOWS_REAL_DATA_SETUP.md` plus the completed smoke evidence.
- Install and uninstall path: link to this runbook plus install/uninstall smoke proof.
- Support runbook: link to this runbook section or support SOP.
- Redacted support export: link to a redacted support bundle export proving paths and filenames are excluded by default.

The checkbox alone does not count. The readiness gate requires both reviewer and artifact evidence.

## Release Stop Conditions

Stop distribution if any of these are true:

- Real cleanup, destructive commands, or unsafe executor flags are visible.
- Native scanner evidence is stale or missing.
- The privacy boundary no longer shows local-only operation and explicit exports.
- Signing or distribution evidence is missing for packaged beta builds.
- Install or uninstall proof is missing.
- Support cannot triage from a redacted bundle.
- Public copy says or implies that the beta can recover space through real deletion.

## Handoff Package

Before sharing a beta build, export and store:

- Dry-run report.
- Native beta evidence ledger.
- Redacted support bundle.
- Workflow handoff.
- Release review packet.
- Validation pack.
- Native rehearsal output.

These artifacts make the beta auditable without granting cleanup authority.
