# Windows Real Data Setup

Use these steps on the Windows machine you want to test.

## Prerequisites

- Windows 10 or 11.
- Node.js and npm.
- Rust and the Tauri prerequisites for Windows.
- Visual Studio Build Tools with the **Desktop development with C++** workload. The native build needs `cl.exe`, `link.exe`, and `lib.exe`.
- OpenAI API key only if you want the Ask AI page.

## Configure

```powershell
npm install
notepad .env
npm run windows:ready
npm run native:dev
```

Set your key in `.env`:

```powershell
OPENAI_API_KEY=sk-...
```

Cleanup does not require route arming. The desktop runtime exposes shipped native allowlists and validates each selected target before deletion.
`windows:ready` exits nonzero until the Windows desktop app can launch; treat that as a stop signal and follow the printed next steps.
Use `npm run windows:ready -- --json` only when you need technical readiness details.
If `windows:ready` reports `toolchain-blocked`, run `npm install`, install or repair Node.js, Rustup/Cargo, and the Tauri Windows prerequisites, restart PowerShell, and run readiness again.
If the missing tool is `Visual Studio C++ Build Tools`, modify Visual Studio Build Tools, select **Desktop development with C++**, then restart PowerShell or use Developer PowerShell for VS before rerunning readiness.

## Launch

```powershell
npm run native:dev
```

The desktop app should show the native bridge as connected. A normal browser tab is setup-only and cannot scan local folders.

## Clean Files

In the app:

1. Click `Scan PC`.
2. Click `Delete all`, or check specific rows.
3. Click `Delete selected` if you checked specific rows.

Support export is only for troubleshooting. It is not required to clean files.

## If The App Is Not Connected

Use the setup panel in the app. It should tell you to install dependencies, optionally set `OPENAI_API_KEY`, run `npm run windows:ready`, and launch with `npm run native:dev`.

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
