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
2. Pick a row marked `can clean`.
3. Check `Delete this selected item from this PC.`
4. Click `Delete selected files`.
5. Click `Refresh space`.

Optional support export can still write `spaceguard-selected-route-proof-packet.md`, `spaceguard-real-workflow-proof.md`, `spaceguard-workflow-proof-check.json`, and `spaceguard-support-bundle.md` from the collapsed `Support details` section.

If the app opens in a normal browser, it will only show connection/setup steps. It will not scan local folders or run cleanup.

## Real Workflow Checks

```powershell
npm run real-app:shell
npm test
npm run build
npm run windows:ready
npm run native:dev
npm run support:bundle
```

For a real cleanup test, use the desktop app as the control point: scan, select one `can clean` target, check the confirmation box, delete, and refresh space.
Optional developer audit only: run `npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md` after exporting support details from the app.

## Safety Boundary

Cleanup is not a generic file deleter. Each target must be visible in the scan, match a shipped native allowlist, pass target validation, pass confirmation, and execute through the desktop cleanup boundary.

Ask AI can explain findings and suggest the next review step. It cannot approve cleanup, bypass confirmation, or call filesystem tools.
