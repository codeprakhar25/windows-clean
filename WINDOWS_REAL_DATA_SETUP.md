# Windows Real Data Setup

Use these steps on the Windows machine you want to test.

## Prerequisites

- Windows 10 or 11.
- Node.js and npm.
- Rust and the Tauri prerequisites for Windows.
- Visual Studio Build Tools with the **Desktop development with C++** workload. The native build needs `cl.exe`, `link.exe`, and `lib.exe`.
- OpenAI API key for the advisory agent.

## Configure

```powershell
npm install
npm run route:arm -- --route npm-cache
notepad .env
npm run windows:ready -- --route npm-cache
npm run windows:dev -- --route npm-cache
```

Set your key in `.env`:

```powershell
OPENAI_API_KEY=sk-...
```

`route:arm` creates or updates `.env`, enables one selected cleanup type, and disables every other cleanup flag. The `windows:dev` command keeps one route armed, checks readiness, and launches the desktop app only when the selected Windows route is ready.
Run `route:arm` before `windows:ready`; otherwise readiness correctly reports `route-arm-required` because no write route is enabled yet.
`windows:ready` exits nonzero until the selected route can launch the native Windows desktop app; treat that as a stop signal and follow the JSON `nextSteps`.
If `windows:ready` reports `toolchain-blocked`, run `npm install`, install or repair Node.js, Rustup/Cargo, and the Tauri Windows prerequisites, restart PowerShell, and run readiness again.
If the missing tool is `Visual Studio C++ Build Tools`, modify Visual Studio Build Tools, select **Desktop development with C++**, then restart PowerShell or use Developer PowerShell for VS before rerunning readiness.

## Launch

```powershell
npm run windows:dev -- --route npm-cache
```

The desktop app should show the native bridge as connected. A normal browser tab is setup-only and cannot scan local folders.

## Test A Route

```powershell
npm run setup:doctor
npm run route:arm -- --route npm-cache
npm run setup:route -- --route npm-cache
npm run windows:ready -- --route npm-cache
npm run openai:smoke -- --local-contract --route npm-cache
npm run openai:smoke -- --route npm-cache
```

Then in the app:

1. Run real scan.
2. Select `npm-cache` if it is ready.
3. Review the target and confirmation phrase.
4. Execute selected cleanup.
5. Run post-run rescan.
6. Export proof. The app writes `spaceguard-selected-route-proof-packet.md`, `spaceguard-real-workflow-proof.md`, `spaceguard-workflow-proof-check.json`, and `spaceguard-support-bundle.md`.
7. Keep another route disabled until the app confirms the in-app verifier accepted the workflow proof and captured the support bundle.

The app runs the workflow proof verifier and support-bundle capture during export. Use the CLI verifier as an external audit if needed:

```powershell
npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md
npm run support:bundle
```

## If The App Is Not Connected

Use the setup panel in the app. It should tell you to install dependencies, set `OPENAI_API_KEY`, arm one scoped executor route, and run `npm run windows:dev -- --route npm-cache`.

## If Tauri Reports A Missing Icon

If Windows build output says:

```powershell
`icons/icon.ico` not found; required for generating a Windows Resource file during tauri-build
```

pull the latest project files or confirm this file exists:

```powershell
Test-Path .\src-tauri\icons\icon.ico
```

Then retry:

```powershell
npm run native:dev
```

The repo includes `src-tauri/icons/icon.ico` and default PNG app icons so the Windows resource build can start.
