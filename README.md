# SpaceGuard

SpaceGuard is a real Windows desktop cleanup app. The browser build is setup-only; local scanning and cleanup require the Tauri desktop shell.

## Run The App

```powershell
npm install
notepad .env
npm run windows:ready
npm run native:dev
```

Set `OPENAI_API_KEY` in `.env` before using the OpenAI cleanup advisor. Cleanup does not require route arming: the desktop runtime exposes shipped native allowlists and validates each selected target before deletion.
`windows:ready` exits nonzero until the Windows desktop app can launch; treat that as a stop signal and follow the JSON `nextSteps`.
If readiness reports `toolchain-blocked`, run `npm install`, install or repair Node.js, Rustup/Cargo, and the Tauri Windows prerequisites, then restart the terminal and rerun the command.

If Tauri reports `icons/icon.ico` not found, confirm `src-tauri/icons/icon.ico` exists, then rerun `npm run native:dev`.


Inside the desktop app:

1. Run real scan.
2. Explore C: allocation or pick one ready row from the real cleanup queue.
3. Review the target and check the consent box.
4. Clean the selected target.
5. Run post-clean rescan.
6. Continue with another allowlisted target if needed.

Optional audit export can still write `spaceguard-selected-route-proof-packet.md`, `spaceguard-real-workflow-proof.md`, `spaceguard-workflow-proof-check.json`, and `spaceguard-support-bundle.md` for support or before/after review.

If the app opens in a normal browser, it will only show connection/setup steps. It will not scan local folders or run cleanup.

## Real Workflow Checks

```powershell
npm run real-app:shell
npm test
npm run build
npm run windows:ready
npm run native:dev
npm run setup:doctor
npm run setup:route -- --route npm-cache
npm run openai:smoke -- --route npm-cache
npm run validate:workflow-proof -- --file spaceguard-real-workflow-proof.md
npm run support:bundle
```

For a real cleanup test, use the desktop app as the control point: scan, select one ready target, consent, clean, and run a post-clean rescan.

## Safety Boundary

Cleanup is not a generic file deleter. Each target must be visible in the real scan, match a shipped native allowlist, pass target validation, pass consent, execute through the native Tauri command, and be followed by a post-clean rescan for current space totals.

The OpenAI advisor can explain findings and suggest the next review step. It cannot approve cleanup, bypass consent, or call filesystem tools.
