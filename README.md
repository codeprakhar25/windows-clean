# SpaceGuard

SpaceGuard is a real Windows desktop cleanup app. The browser build is setup-only; local scanning and cleanup require the Tauri desktop shell.

## Run The App

```powershell
npm install
Copy-Item .env.example .env
notepad .env
npm run native:dev
```

Set `OPENAI_API_KEY` in `.env` before using the OpenAI cleanup advisor. Enable exactly one executor flag for the route you want to test, for example:

```powershell
SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR=1
```

The app's route setup wizard also shows a copyable selected `.env` block for each route. Use that block to avoid accidentally enabling multiple executor flags.

Inside the desktop app:

1. Run real scan.
2. Pick one ready row from the real cleanup queue.
3. Review the target, check the consent box, and type the exact confirmation phrase.
4. Execute selected cleanup.
5. Run post-run rescan.
6. Export `spaceguard-selected-route-proof-packet.md`, `spaceguard-real-workflow-proof.md`, and `spaceguard-workflow-proof-check.json`.

The app runs the workflow proof verifier during export. The CLI verifier below remains useful as an external audit.

If the app opens in a normal browser, it will only show connection/setup steps. It will not scan local folders or run cleanup.

## Real Workflow Checks

```powershell
npm run real-app:shell
npm test
npm run build
npm run setup:doctor
npm run setup:route -- --route npm-cache
npm run openai:smoke -- --route npm-cache
npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md
```

For a real route test, use the desktop app as the control point: scan, select one ready route, consent, execute, rescan, and export proof.

## Safety Boundary

Cleanup is not a generic file deleter. Each route must be visible in the real scan, match a scoped native executor, have exactly one enabled feature flag, pass consent, execute through the native Tauri command, and match a post-run rescan before proof export is considered ready.

The OpenAI advisor can explain findings and suggest the next review step. It cannot approve cleanup, unlock feature flags, or call filesystem tools.
