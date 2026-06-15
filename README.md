<p align="center">
  <img src="logo.svg" width="120" alt="SpaceGuard"/>
</p>

# SpaceGuard

![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D4?logo=windows&logoColor=white)
![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%20v2-FFC131?logo=tauri&logoColor=black)
![Rust](https://img.shields.io/badge/backend-Rust-CE422B?logo=rust&logoColor=white)
![React](https://img.shields.io/badge/frontend-React-61DAFB?logo=react&logoColor=black)
![Latest Release](https://img.shields.io/github/v/release/codeprakhar25/windows-clean?color=brightgreen)
![License](https://img.shields.io/github/license/codeprakhar25/windows-clean)

**SpaceGuard** is a developer junk cleaner for Windows. It scans for safe-to-delete caches, temp files, and stale build artifacts — and typically recovers **10–30 GB** on a dev machine. Nothing is deleted until you confirm.

---

## What it cleans

| Category | What gets removed |
|---|---|
| npm / pnpm cache | `%AppData%\npm-cache`, pnpm content store |
| pip cache | `%LocalAppData%\pip\cache` |
| Gradle cache | `~\.gradle\caches` |
| Docker build cache | Dangling build layers |
| Browser cache | Chrome, Edge, Firefox, Brave cache folders |
| Windows temp files | `%TEMP%`, `C:\Windows\Temp` |
| node\_modules | Stale project dependency trees |
| Android Studio cache | `~\.android`, AVD caches |
| Shader cache | GPU shader compile caches |
| Recycle Bin | Queued deletions |
| Downloads | Large files and old installers |
| User .cache | `~\.cache` leftovers |

---

## Download

Grab the latest Windows installer from the **[Releases](https://github.com/codeprakhar25/windows-clean/releases)** page.

> Requires Windows 10 / 11 x64. No Rust or Node needed — the `.exe` is self-contained.

> **Windows SmartScreen warning:** Click **More info** → **Run anyway** on first launch. The app is unsigned (no cert yet). Source code is fully auditable above.

---

## Build from source

**Prerequisites:** [Node.js 18+](https://nodejs.org) · [Rust stable](https://rustup.rs) · [Tauri v2 prerequisites](https://tauri.app/start/prerequisites/)

```bash
git clone https://github.com/codeprakhar25/windows-clean.git
cd windows-clean
npm install
npm run tauri build
```

Installer output: `src-tauri/target/release/bundle/nsis/SpaceGuard_*_x64-setup.exe`

**Dev mode:**

```bash
npm run tauri dev
```

---

## How it works

1. Click **Scan PC** — read-only scan, nothing is touched.
2. Review the findings — each row shows what will be removed and why it is safe.
3. Click **Delete all** or check specific rows and click **Delete selected**.
4. Files go to the **Recycle Bin** (not hard-deleted), so you can undo.

Every target must pass SpaceGuard's native allowlist before the delete button activates. The app cannot delete files outside the scanned categories.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 · Vite · Tailwind CSS · shadcn/ui |
| Backend | Rust · Tauri v2 |
| Delete safety | Windows Shell `SHFileOperationW` — Recycle Bin, not `rm` |

---

## License

MIT — see [LICENSE](LICENSE)
