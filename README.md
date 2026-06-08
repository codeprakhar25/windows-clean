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
6. Export `spaceguard-selected-route-proof-packet.md` and `spaceguard-real-workflow-proof.md`.

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

The full Windows V1 proof coordinator runs the preflight, first-route proof, selected-route proof, OpenAI smoke checks, native bundle capture, and final verifier:

```powershell
npm run v1:windows -- -SelectedRoute npm-cache
npm run v1:windows -- -SelectedRoute gradle-cache
npm run validate:v1-proof -- --file evidence/v1-proof-npm-cache-YYYYMMDD-HHMMSS/v1-proof.json
```

The V1 proof records native bundle artifact evidence. The preflight copies each native bundle artifact into the evidence folder and stores a SHA-256 hash for each copied native bundle artifact.

## Safety Boundary

Cleanup is not a generic file deleter. Each route must be visible in the real scan, match a scoped native executor, have exactly one enabled feature flag, pass consent, execute through the native Tauri command, and match a post-run rescan before proof export is considered ready.

The OpenAI advisor can explain findings and suggest the next review step. It cannot approve cleanup, unlock feature flags, or call filesystem tools.
