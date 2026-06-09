# SpaceGuard

SpaceGuard is a real Windows desktop cleanup app. The browser build is setup-only; local scanning and cleanup require the Tauri desktop shell.

## Run The App

```powershell
npm install
Copy-Item .env.example .env
notepad .env
npm run route:arm -- --route npm-cache
npm run windows:ready -- --route npm-cache
npm run windows:dev -- --route npm-cache
```

Set `OPENAI_API_KEY` in `.env` before using the OpenAI cleanup advisor. `npm run windows:dev -- --route npm-cache` arms the selected cleanup type, checks readiness, and launches the desktop app only when the Windows route is ready.
Run `route:arm` before `windows:ready`; otherwise readiness correctly reports `route-arm-required` because no write route is enabled yet.
If readiness reports `toolchain-blocked`, run `npm install`, install or repair Node.js, Rustup/Cargo, and the Tauri Windows prerequisites, then restart the terminal and rerun the command.

Inside the desktop app:

1. Run real scan.
2. Pick one ready row from the real cleanup queue.
3. Review the target, check the consent box, and type the exact confirmation phrase.
4. Execute selected cleanup.
5. Run post-run rescan.
6. Export proof. The app writes `spaceguard-selected-route-proof-packet.md`, `spaceguard-real-workflow-proof.md`, `spaceguard-workflow-proof-check.json`, and `spaceguard-support-bundle.md`.
7. Keep another route disabled until the app confirms the in-app verifier accepted the workflow proof and the support bundle was captured.

The app runs the workflow proof verifier and support-bundle capture during export. The CLI verifier below remains useful as an external audit.

If the app opens in a normal browser, it will only show connection/setup steps. It will not scan local folders or run cleanup.

## Real Workflow Checks

```powershell
npm run real-app:shell
npm test
npm run build
npm run route:arm -- --route npm-cache
npm run windows:ready -- --route npm-cache
npm run windows:dev -- --route npm-cache --dry-run
npm run setup:doctor
npm run setup:route -- --route npm-cache
npm run openai:smoke -- --route npm-cache
npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md
npm run support:bundle
```

For a real route test, use the desktop app as the control point: scan, select one ready route, consent, execute, rescan, and export proof.

## Safety Boundary

Cleanup is not a generic file deleter. Each route must be visible in the real scan, match a scoped native executor, have exactly one enabled feature flag, pass consent, execute through the native Tauri command, and match a post-run rescan before proof export is considered ready.

The OpenAI advisor can explain findings and suggest the next review step. It cannot approve cleanup, unlock feature flags, or call filesystem tools.
