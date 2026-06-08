# Windows Real Data Setup

Use these steps on the Windows machine you want to test.

## Prerequisites

- Windows 10 or 11.
- Node.js and npm.
- Rust and the Tauri prerequisites for Windows.
- OpenAI API key for the advisory agent.

## Configure

```powershell
npm install
Copy-Item .env.example .env
notepad .env
```

Set:

```powershell
OPENAI_API_KEY=sk-...
SPACEGUARD_ENABLE_NPM_CACHE_EXECUTOR=1
```

Keep only one `SPACEGUARD_ENABLE_*_EXECUTOR` flag enabled while testing a route.
The route setup wizard in the app shows a copyable selected `.env` block for the route you pick.

## Launch

```powershell
npm run native:dev
```

The desktop app should show the native bridge as connected. A normal browser tab is setup-only and cannot scan local folders.

## Test A Route

```powershell
npm run setup:doctor
npm run setup:route -- --route npm-cache
npm run openai:smoke -- --route npm-cache
```

Then in the app:

1. Run real scan.
2. Select `npm-cache` if it is ready.
3. Review the target and confirmation phrase.
4. Execute selected cleanup.
5. Run post-run rescan.
6. Export proof. The app writes `spaceguard-selected-route-proof-packet.md`, `spaceguard-real-workflow-proof.md`, and `spaceguard-workflow-proof-check.json`.
7. Capture the support bundle.

The app runs the workflow proof verifier during export. Use the CLI verifier as an external audit if needed:

```powershell
npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md
npm run support:bundle
```

## If The App Is Not Connected

Use the setup panel in the app. It should tell you to install dependencies, set `OPENAI_API_KEY`, enable one scoped executor flag, and run `npm run native:dev`.
