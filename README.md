# SpaceGuard

SpaceGuard is a real Windows desktop cleanup app. The browser build is setup-only; local scanning and cleanup require the Tauri desktop shell.

## Run The App

```powershell
npm install
notepad .env
npm run windows:ready
npm run native:dev
```

Set `OPENAI_API_KEY` in `.env` only if you want the Ask AI page. Cleanup does not require route arming: the desktop runtime exposes shipped native allowlists and validates each selected target before deletion.
`windows:ready` exits nonzero until the Windows desktop app can launch; treat that as a stop signal and follow the JSON `nextSteps`.
If readiness reports `toolchain-blocked`, run `npm install`, install or repair Node.js, Rustup/Cargo, and the Tauri Windows prerequisites, then restart the terminal and rerun the command.

If Tauri reports `icons/icon.ico` not found, confirm `src-tauri/icons/icon.ico` exists, then rerun `npm run native:dev`.


Inside the desktop app:

1. Click `Scan PC`.
2. Check one row marked `can clean`.
3. Click `Delete selected files`.

If the app opens in a normal browser, it will only show connection/setup steps. It will not scan local folders or run cleanup.

## Developer Checks

```powershell
npm run real-app:shell
npm test
npm run build
npm run windows:ready
npm run native:dev
```

For a real cleanup test, use the desktop app as the control point: scan, check one `can clean` target, and delete.
Support export tools are for troubleshooting only. They are not required to clean files.

## Safety Boundary

Cleanup is not a generic file deleter. Each target must be visible in the scan, match a shipped native allowlist, pass target validation, pass confirmation, and execute through the desktop cleanup boundary.

Ask AI can explain findings and suggest the next review step. It cannot approve cleanup, bypass confirmation, or call filesystem tools.
